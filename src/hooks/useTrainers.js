import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { db } from '../firebase/config';
import { getSecondaryAuth } from '../firebase/secondaryApp';
import { normalizePhone } from '../utils/phone';

export function useTrainers() {
  const [trainers, setTrainers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'trainers'), orderBy('name'));
    const unsub = onSnapshot(q,
      snap => { setTrainers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useTrainers:', err); setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  // ── Create trainer with auth account ───────────────────────────
  //
  // Uses the secondary Firebase app so the admin's primary session is
  // untouched. After the create call, we explicitly sign out the secondary
  // app so we don't accidentally hold an extra session in memory.
  async function createTrainer({ name, email, password, phone, speciality, avatar }) {
    if (!email || !password) throw new Error('Email and password are required.');
    if (password.length < 6)  throw new Error('Password must be at least 6 characters.');
    if (!name?.trim())        throw new Error('Name is required.');

    const secondaryAuth = getSecondaryAuth();
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
    } catch (e) {
      // Translate common Firebase auth errors to friendly messages
      if (e.code === 'auth/email-already-in-use')  throw new Error('That email is already in use.');
      if (e.code === 'auth/invalid-email')          throw new Error('Invalid email.');
      if (e.code === 'auth/weak-password')          throw new Error('Password too weak.');
      throw new Error(e.message || 'Failed to create user.');
    }

    const uid = userCredential.user.uid;

    // 1) trainer profile document
    const trainerRef = await addDoc(collection(db, 'trainers'), {
      name:       name.trim(),
      phone:      normalizePhone(phone),
      phoneRaw:   phone || '',
      email:      email.trim(),
      speciality: speciality?.trim() || '',
      avatar:     avatar || '',
      avgRating:  0,
      userId:     uid,
      createdAt:  serverTimestamp(),
    });

    // 2) users/{uid} record with role + profile back-pointer
    await setDoc(doc(db, 'users', uid), {
      role:      'trainer',
      profileId: trainerRef.id,
      email:     email.trim(),
      createdAt: serverTimestamp(),
    });

    // 3) Sign out secondary app so we don't leak its session
    try { await fbSignOut(secondaryAuth); } catch (_) { /* non-fatal */ }

    return trainerRef.id;
  }

  async function updateTrainer(id, data) {
    const merge = { ...data };
    if (data.phone !== undefined) {
      merge.phone    = normalizePhone(data.phone);
      merge.phoneRaw = data.phone;
    }
    await updateDoc(doc(db, 'trainers', id), { ...merge, updatedAt: serverTimestamp() });
  }

  // Soft-remove the trainer document. Note this does NOT delete the auth user —
  // that requires admin SDK / cloud functions. We just orphan the auth account
  // (which can be addressed in Phase 4 with a cleanup function, or manually).
  async function removeTrainer(id) {
    const snap = await getDoc(doc(db, 'trainers', id));
    await deleteDoc(doc(db, 'trainers', id));

    // Also delete the users/{uid} mapping if we can find it
    if (snap.exists() && snap.data().userId) {
      try { await deleteDoc(doc(db, 'users', snap.data().userId)); } catch (_) {}
    }
  }

  return { trainers, loading, error, createTrainer, updateTrainer, removeTrainer };
}
