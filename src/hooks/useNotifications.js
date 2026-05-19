import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, where, orderBy, limit,
  doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Subscribe to the current user's notifications (most recent 50).
// Returns { notifications, unreadCount, loading } and writer helpers.
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!userId) { setNotifications([]); setLoading(false); return; }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q,
      snap => { setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error('useNotifications:', err); setLoading(false); }
    );
    return () => unsub();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markRead(id) {
    await updateDoc(doc(db, 'notifications', id), { read: true, readAt: serverTimestamp() });
  }

  async function markAllRead() {
    if (!userId) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true, readAt: serverTimestamp() }));
    await batch.commit();
  }

  async function removeNotification(id) {
    await deleteDoc(doc(db, 'notifications', id));
  }

  return { notifications, unreadCount, loading, markRead, markAllRead, removeNotification };
}

// One-shot helper to create a notification (used by triggers throughout the app)
export async function createNotification({ userId, kind, title, body, link }) {
  if (!userId) return null;
  return await addDoc(collection(db, 'notifications'), {
    userId,
    kind,
    title,
    body: body || '',
    link: link || null,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// Bulk-create for "notify many users at once" (e.g. class cancelled → notify
// every booked client)
export async function createNotificationsBulk(entries) {
  if (!entries.length) return;
  const batch = writeBatch(db);
  entries.forEach(e => {
    if (!e.userId) return;
    const ref = doc(collection(db, 'notifications'));
    batch.set(ref, {
      userId:    e.userId,
      kind:      e.kind,
      title:     e.title,
      body:      e.body || '',
      link:      e.link || null,
      read:      false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}
