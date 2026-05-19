// Trainer payments are stored as `expenses/` docs with:
//   { isIncome: false, category: 'Trainer Payment', trainerId, amount,
//     method, date, month, description, createdAt }
//
// Single source of truth — finance page picks them up automatically because
// they're in the expenses collection. The trainer payments page filters by
// trainerId.

import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy,
  addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Subscribe to a trainer's payments, optionally filtered to a 'YYYY-MM' month.
export function useTrainerPayments({ trainerId, month } = {}) {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!trainerId) { setPayments([]); setLoading(false); return; }
    setLoading(true);

    const constraints = [
      where('trainerId', '==', trainerId),
      where('category',  '==', 'Trainer Payment'),
    ];
    if (month) constraints.push(where('month', '==', month));
    constraints.push(orderBy('date', 'desc'));

    const q = query(collection(db, 'expenses'), ...constraints);
    const unsub = onSnapshot(q,
      snap => { setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useTrainerPayments:', err); setLoading(false); }
    );
    return () => unsub();
  }, [trainerId, month]);

  return { payments, loading };
}

// Log a payment to a trainer.
export async function logTrainerPayment({ trainer, amount, method, date, description }) {
  if (!trainer?.id)                            throw new Error('Trainer required.');
  if (!amount || Number(amount) <= 0)          throw new Error('Amount must be greater than 0.');
  if (!['Cash', 'Whish'].includes(method))     throw new Error('Method must be Cash or Whish.');
  if (!date)                                    throw new Error('Date is required.');

  await addDoc(collection(db, 'expenses'), {
    isIncome:    false,
    category:    'Trainer Payment',
    trainerId:   trainer.id,
    trainerName: trainer.name,
    amount:      Number(amount),
    method,
    date,
    month:       date.slice(0, 7),
    description: description?.trim() || `Payment to ${trainer.name}`,
    createdAt:   serverTimestamp(),
  });
}
