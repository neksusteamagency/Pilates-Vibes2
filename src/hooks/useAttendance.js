import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where,
  addDoc, updateDoc, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Subscribe to attendance records — by class or by date range
export function useAttendance({ classId, startDate, endDate } = {}) {
  const [attendance, setAttendance] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!classId && !startDate) { setAttendance([]); setLoading(false); return; }
    setLoading(true);

    const constraints = [];
    if (classId)   constraints.push(where('classId', '==', classId));
    if (startDate) constraints.push(where('date',    '>=', startDate));
    if (endDate)   constraints.push(where('date',    '<=', endDate));

    const q = query(collection(db, 'attendance'), ...constraints);
    const unsub = onSnapshot(q,
      snap => { setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useAttendance:', err); setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [classId, startDate, endDate]);

  return { attendance, loading, error };
}

// Mark attendance for a booking. If a record already exists for this booking,
// update it (admin can change attended ↔ no-show).
// No session deduction happens here — the session was already deducted at
// booking time. No-show simply doesn't refund.
export async function markAttendance({ booking, status, markedBy = 'admin' }) {
  // Look for an existing record
  const existing = await getDocs(query(
    collection(db, 'attendance'),
    where('bookingId', '==', booking.id),
  ));

  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, { status, markedAt: serverTimestamp(), markedBy });
    return existing.docs[0].id;
  } else {
    const ref = await addDoc(collection(db, 'attendance'), {
      bookingId:  booking.id,
      classId:    booking.classId,
      clientId:   booking.clientId,
      clientName: booking.clientName,
      date:       booking.date,
      status,
      markedAt:   serverTimestamp(),
      markedBy,
    });
    return ref.id;
  }
}
