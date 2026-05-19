import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy,
  doc, addDoc, updateDoc, getDoc, runTransaction,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { checkBookingEligibility, checkSelfCancellation } from '../utils/bookingRules';
import {
  notifyAdminNewBooking, notifyAdminBookingCancelled, notifyAdminLowSessions,
} from '../utils/notify';

const LOW_SESSIONS_TRIGGER_THRESHOLD = 2;

export function useBookings({ classId, clientId } = {}) {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!classId && !clientId) { setBookings([]); setLoading(false); return; }
    setLoading(true);

    const constraints = [];
    if (classId)  constraints.push(where('classId',  '==', classId));
    if (clientId) constraints.push(where('clientId', '==', clientId));
    constraints.push(orderBy('bookedAt', 'desc'));

    const q = query(collection(db, 'bookings'), ...constraints);
    const unsub = onSnapshot(q,
      snap => { setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useBookings:', err); setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [classId, clientId]);

  return { bookings, loading, error };
}

// ── Admin/internal: book a class ──
// Returns { bookingId, classData, clientData } so the caller can fire notifs.
export async function bookClass({ classId, client, bookedBy = 'admin' }) {
  let classData, clientData;
  const bookingId = await runTransaction(db, async (tx) => {
    const classRef  = doc(db, 'classes', classId);
    const clientRef = doc(db, 'clients', client.id);

    const [classSnap, clientSnap] = await Promise.all([tx.get(classRef), tx.get(clientRef)]);
    if (!classSnap.exists())  throw new Error('Class not found.');
    if (!clientSnap.exists()) throw new Error('Client not found.');

    const c   = classSnap.data();
    const cli = clientSnap.data();

    if ((c.bookedCount || 0) >= (c.capacity || 6)) throw new Error('Class is full.');
    if (c.status === 'cancelled') throw new Error('Class is cancelled.');

    if (!cli.pkg)        throw new Error('Client has no package.');
    if (cli.isFrozen)    throw new Error('Client package is frozen.');
    if (cli.pkgExpiry && cli.pkgExpiry < new Date().toISOString().slice(0, 10))
                         throw new Error('Client package has expired.');
    if (!cli.pkgUnlimited && (cli.pkgSessions ?? 0) <= 0)
                         throw new Error('Client has no sessions left.');

    const bookingRef = doc(collection(db, 'bookings'));
    tx.set(bookingRef, {
      classId, clientId: client.id, clientName: cli.name,
      date: c.date, time: c.time, status: 'confirmed',
      bookedAt: serverTimestamp(), bookedBy,
    });

    const newCount = (c.bookedCount || 0) + 1;
    tx.update(classRef, {
      bookedCount: newCount,
      status: newCount >= (c.capacity || 6) ? 'full' : 'available',
    });

    if (!cli.pkgUnlimited) {
      tx.update(clientRef, {
        pkgSessions: Math.max(0, (cli.pkgSessions || 0) - 1),
        updatedAt:   serverTimestamp(),
      });
    }

    classData  = { id: classSnap.id, ...c };
    clientData = { id: clientSnap.id, ...cli, pkgSessions: Math.max(0, (cli.pkgSessions || 0) - 1) };

    return bookingRef.id;
  });

  return { bookingId, classData, clientData };
}

// ── Client-self booking ──
export async function clientSelfBookClass({ classId, client }) {
  const classSnap = await getDoc(doc(db, 'classes', classId));
  if (!classSnap.exists()) throw new Error('Class not found.');
  const classRef = { id: classSnap.id, ...classSnap.data() };

  const check = checkBookingEligibility({ client, classRef, isClientSelf: true });
  if (!check.ok) throw new Error(check.reason);

  const { bookingId, classData, clientData } = await bookClass({ classId, client, bookedBy: 'client' });

  if (!client.pkgPaid) {
    await updateDoc(doc(db, 'clients', client.id), {
      pkgBookingsBeforeVerification: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  // Admin notifications (fire-and-forget — failures shouldn't break the booking)
  try {
    await notifyAdminNewBooking({
      clientName: client.name,
      className:  classData.name,
      date:       classData.date,
      time:       classData.time,
    });

    // Low-sessions warning only when crossing the threshold downward (no spam)
    const wasAbove   = (client.pkgSessions ?? 0) > LOW_SESSIONS_TRIGGER_THRESHOLD;
    const isAtOrBelow = (clientData.pkgSessions ?? 0) <= LOW_SESSIONS_TRIGGER_THRESHOLD;
    if (!client.pkgUnlimited && wasAbove && isAtOrBelow && clientData.pkgSessions > 0) {
      await notifyAdminLowSessions({
        clientName:   client.name,
        sessionsLeft: clientData.pkgSessions,
      });
    }
  } catch (e) { console.warn('Notification failed:', e); }

  return bookingId;
}

// ── Cancel booking (admin or internal) ──
// `notifyAdmins` controls whether to fire the admin notification. Set to
// false when admin themselves triggered the cancel (so they don't notify
// themselves), true when a client-self-cancel cascades here.
export async function cancelBooking({ bookingId, returnSession = true, cancelledBy = 'admin', notifyAdmins = false }) {
  let bookingData;
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bSnap = await tx.get(bookingRef);
    if (!bSnap.exists()) throw new Error('Booking not found.');
    const b = bSnap.data();
    if (b.status === 'cancelled') return;
    bookingData = { id: bSnap.id, ...b };

    const classRef  = doc(db, 'classes', b.classId);
    const clientRef = doc(db, 'clients', b.clientId);
    const [classSnap, clientSnap] = await Promise.all([tx.get(classRef), tx.get(clientRef)]);

    tx.update(bookingRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy,
    });

    if (classSnap.exists()) {
      const c = classSnap.data();
      tx.update(classRef, {
        bookedCount: Math.max(0, (c.bookedCount || 0) - 1),
        status: c.status === 'cancelled' ? 'cancelled' : 'available',
      });
    }

    if (returnSession && clientSnap.exists()) {
      const cli = clientSnap.data();
      if (!cli.pkgUnlimited) {
        tx.update(clientRef, {
          pkgSessions: (cli.pkgSessions || 0) + 1,
          updatedAt:   serverTimestamp(),
        });
      }
    }
  });

  if (notifyAdmins && bookingData) {
    try {
      // Fetch class name for the notification body
      const classSnap = await getDoc(doc(db, 'classes', bookingData.classId));
      const className = classSnap.exists() ? classSnap.data().name : 'class';
      await notifyAdminBookingCancelled({
        clientName: bookingData.clientName,
        className,
        date:       bookingData.date,
        time:       bookingData.time,
      });
    } catch (e) { console.warn('Notification failed:', e); }
  }
}

// ── Client-self cancellation ──
export async function clientSelfCancelBooking({ booking }) {
  const check = checkSelfCancellation({ booking });
  if (!check.ok) throw new Error(check.reason);
  // Pass notifyAdmins:true because the client is the one cancelling
  await cancelBooking({ bookingId: booking.id, returnSession: true, cancelledBy: 'client', notifyAdmins: true });
}

export async function getBooking(id) {
  const snap = await getDoc(doc(db, 'bookings', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateBooking(id, data) {
  await updateDoc(doc(db, 'bookings', id), { ...data, updatedAt: serverTimestamp() });
}
