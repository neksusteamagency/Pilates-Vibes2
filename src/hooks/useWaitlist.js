import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy,
  doc, addDoc, updateDoc, getDoc, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { bookClass } from './useBookings';
import { notifyAdminWaitlistJoin } from '../utils/notify';

export function useWaitlist({ classId, statusFilter = 'pending' } = {}) {
  const [waitlist, setWaitlist] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    const constraints = [];
    if (classId)      constraints.push(where('classId', '==', classId));
    if (statusFilter) constraints.push(where('status',  '==', statusFilter));
    constraints.push(orderBy('joinedAt'));

    const q = query(collection(db, 'waitlist'), ...constraints);
    const unsub = onSnapshot(q,
      snap => { setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useWaitlist:', err); setLoading(false); }
    );
    return () => unsub();
  }, [classId, statusFilter]);

  return { waitlist, loading };
}

export async function joinWaitlist({ classRef, client }) {
  const ref = await addDoc(collection(db, 'waitlist'), {
    classId:    classRef.id,
    clientId:   client.id,
    clientName: client.name,
    date:       classRef.date,
    time:       classRef.time,
    status:     'pending',
    joinedAt:   serverTimestamp(),
  });

  // Notify admins of the new waitlist entry
  try {
    await notifyAdminWaitlistJoin({
      clientName: client.name,
      className:  classRef.name,
      date:       classRef.date,
    });
  } catch (e) { console.warn('Notify admin failed:', e); }

  return ref;
}

// Approve a waitlist entry → create a real booking (deducts session)
// No client-facing notification (clients don't get notifications).
export async function approveWaitlist(entryId) {
  const entrySnap = await getDoc(doc(db, 'waitlist', entryId));
  if (!entrySnap.exists()) throw new Error('Waitlist entry not found.');
  const entry = entrySnap.data();

  // Fetch the client doc for the booking transaction
  const clientSnap = await getDoc(doc(db, 'clients', entry.clientId));
  const client = clientSnap.exists()
    ? { id: clientSnap.id, ...clientSnap.data() }
    : { id: entry.clientId, name: entry.clientName };

  await bookClass({
    classId: entry.classId,
    client,
    bookedBy: 'admin-waitlist',
  });

  await updateDoc(doc(db, 'waitlist', entryId), {
    status:     'approved',
    approvedAt: serverTimestamp(),
  });
}

export async function rejectWaitlist(entryId) {
  await updateDoc(doc(db, 'waitlist', entryId), {
    status:     'rejected',
    rejectedAt: serverTimestamp(),
  });
}