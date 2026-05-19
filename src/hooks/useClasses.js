import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy,
  doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Subscribes in real-time to classes within a date range, optionally
// filtered by trainerId. Pass startDate + endDate as 'YYYY-MM-DD'.
export function useClasses({ startDate, endDate, trainerId } = {}) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    const constraints = [];
    if (startDate) constraints.push(where('date', '>=', startDate));
    if (endDate)   constraints.push(where('date', '<=', endDate));
    constraints.push(orderBy('date'), orderBy('time'));

    const q = query(collection(db, 'classes'), ...constraints);
    const unsub = onSnapshot(q,
      snap => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (trainerId) list = list.filter(c => c.trainerId === trainerId);
        setClasses(list);
        setLoading(false);
      },
      err => { console.error('useClasses:', err); setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [startDate, endDate, trainerId]);

  async function addClass(data) {
    return await addDoc(collection(db, 'classes'), {
      bookedCount: 0,
      status: 'available',
      isRecurring: false,
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  async function updateClass(id, data) {
    await updateDoc(doc(db, 'classes', id), { ...data, updatedAt: serverTimestamp() });
  }

  async function removeClass(id) {
    await deleteDoc(doc(db, 'classes', id));
  }

  // Bulk-delete future instances of a recurring rule
  async function removeFutureInstances(recurrenceId, fromDate) {
    const q2 = query(
      collection(db, 'classes'),
      where('recurrenceId', '==', recurrenceId),
      where('date', '>=', fromDate),
    );
    const snap = await getDocs(q2);
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return snap.size;
  }

  // Bulk-update future instances of a recurring rule
  async function updateFutureInstances(recurrenceId, fromDate, changes) {
    const q2 = query(
      collection(db, 'classes'),
      where('recurrenceId', '==', recurrenceId),
      where('date', '>=', fromDate),
    );
    const snap = await getDocs(q2);
    if (snap.empty) return 0;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { ...changes, updatedAt: serverTimestamp() }));
    await batch.commit();
    return snap.size;
  }

  return {
    classes, loading, error,
    addClass, updateClass, removeClass,
    removeFutureInstances, updateFutureInstances,
  };
}
