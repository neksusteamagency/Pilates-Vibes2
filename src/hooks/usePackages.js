import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, addDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export function useCustomPackages() {
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'customPackages'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      snap => { setPackages(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useCustomPackages:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  async function addCustomPackage(data) {
    return await addDoc(collection(db, 'customPackages'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function updateCustomPackage(id, data) {
    await updateDoc(doc(db, 'customPackages', id), {
      ...data, updatedAt: serverTimestamp(),
    });
  }

  async function removeCustomPackage(id) {
    await deleteDoc(doc(db, 'customPackages', id));
  }

  return { packages, loading, addCustomPackage, updateCustomPackage, removeCustomPackage };
}
