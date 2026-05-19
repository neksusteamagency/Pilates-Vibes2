import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where,
  doc, addDoc, updateDoc, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatYMD, parseYMD, dayOfWeek } from '../utils/dates';

const MATERIALIZE_WEEKS = 12; // generate 12 weeks of instances per rule

// Subscribe to all active recurrence rules
export function useRecurrenceRules() {
  const [rules, setRules]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'recurrenceRules'), where('active', '==', true));
    const unsub = onSnapshot(q,
      snap => { setRules(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useRecurrenceRules:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  return { rules, loading };
}

// Materialize MATERIALIZE_WEEKS of class instances starting from startDate.
// Each instance is stored in `classes/` with recurrenceId pointing back.
export async function materializeRecurrence(ruleId, ruleData) {
  const start  = parseYMD(ruleData.startDate);
  const target = parseYMD(ruleData.startDate);
  target.setDate(target.getDate() + MATERIALIZE_WEEKS * 7);

  // Find the first date >= startDate that matches the target day-of-week
  const targetDow = ruleData.dayOfWeek;
  const cursor   = new Date(start);
  while (dayOfWeek(formatYMD(cursor)) !== targetDow) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const batch = writeBatch(db);
  while (cursor <= target) {
    const ymd = formatYMD(cursor);
    const ref = doc(collection(db, 'classes'));
    batch.set(ref, {
      name:         ruleData.name,
      date:         ymd,
      time:         ruleData.time,
      trainer:      ruleData.trainer,
      trainerId:    ruleData.trainerId,
      capacity:     ruleData.capacity || 6,
      bookedCount:  0,
      status:       'available',
      isRecurring:  true,
      recurrenceId: ruleId,
      dayOfWeek:    targetDow,
      createdAt:    serverTimestamp(),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  await batch.commit();
}

// Create a recurring rule and materialize its instances
export async function createRecurrence(ruleData) {
  const ref = await addDoc(collection(db, 'recurrenceRules'), {
    ...ruleData,
    active: true,
    createdAt: serverTimestamp(),
  });
  await materializeRecurrence(ref.id, ruleData);
  return ref.id;
}

// Deactivate a rule (instances remain — caller can clean up separately)
export async function deactivateRecurrence(ruleId) {
  await updateDoc(doc(db, 'recurrenceRules', ruleId), {
    active: false,
    deactivatedAt: serverTimestamp(),
  });
}

// Update the rule definition (caller propagates to future instances)
export async function updateRecurrence(ruleId, changes) {
  await updateDoc(doc(db, 'recurrenceRules', ruleId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}
