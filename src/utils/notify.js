// Admin-only notifications. Clients and trainers do not receive any.
//
// All trigger functions here look up the current list of admin users and
// create one notification per admin. The lookup is one Firestore query per
// event (admins are a small set, so this is cheap).

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { createNotificationsBulk } from '../hooks/useNotifications';
import { formatDateLong, formatTime } from './dates';

// One-shot helper: returns array of admin UIDs.
async function fetchAdminUserIds() {
  const q = query(collection(db, 'users'), where('role', '==', 'admin'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.id);
}

// Internal: fan out a notification to all admins.
async function notifyAllAdmins({ kind, title, body, link }) {
  const adminIds = await fetchAdminUserIds();
  if (!adminIds.length) return;
  await createNotificationsBulk(
    adminIds.map(userId => ({ userId, kind, title, body, link })),
  );
}

// ── Triggers ────────────────────────────────────────────────────

export async function notifyAdminNewSignup({ clientName }) {
  return await notifyAllAdmins({
    kind:  'new-signup',
    title: 'New client signed up',
    body:  `${clientName} just created an account.`,
    link:  '/admin/clients',
  });
}

export async function notifyAdminNewBooking({ clientName, className, date, time }) {
  return await notifyAllAdmins({
    kind:  'new-booking',
    title: 'New booking',
    body:  `${clientName} booked ${className} on ${formatDateLong(date)} at ${formatTime(time)}.`,
    link:  '/admin/schedule',
  });
}

export async function notifyAdminBookingCancelled({ clientName, className, date, time }) {
  return await notifyAllAdmins({
    kind:  'booking-cancelled',
    title: 'Booking cancelled',
    body:  `${clientName} cancelled ${className} on ${formatDateLong(date)} at ${formatTime(time)}. Session returned.`,
    link:  '/admin/schedule',
  });
}

export async function notifyAdminLowSessions({ clientName, sessionsLeft }) {
  return await notifyAllAdmins({
    kind:  'low-sessions',
    title: 'Client running low on sessions',
    body:  `${clientName} has ${sessionsLeft} session${sessionsLeft === 1 ? '' : 's'} left.`,
    link:  '/admin/clients',
  });
}

export async function notifyAdminWaitlistJoin({ clientName, className, date }) {
  return await notifyAllAdmins({
    kind:  'waitlist-join',
    title: 'New waitlist entry',
    body:  `${clientName} joined the waitlist for ${className} on ${formatDateLong(date)}.`,
    link:  '/admin/schedule',
  });
}
