// Build a wa.me link with optional pre-filled message.
// Accepts a canonical 8-digit Lebanese phone (no +) and prepends 961.

import { normalizePhone, isValidLebanesePhone } from './phone';
import { formatDateLong, formatTime } from './dates';

const STUDIO_NAME = 'Pilates Vibes';

export function buildWhatsAppLink(phone, message = '') {
  const canonical = normalizePhone(phone);
  if (!isValidLebanesePhone(canonical)) return null;
  const intl = `961${canonical}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${intl}${text}`;
}

// ── Templated messages ──────────────────────────────────────────

export function msgBookingConfirmation({ className, date, time, trainer, spots = 1 }) {
  return `Hello beautiful 🩷

I'm just checking in to confirm your spot for the ${className} tomorrow ⏰ ${formatTime(time)} with ${trainer}
👯 for ${spots} ${spots === 1 ? 'prs' : 'prs'}

Please remember to arrive at least 5 minutes early! And don't forget your grip socks 🧦! Or you can buy from our studio.

*Quick reminder — cancellations need to be made at least 12 hours before class to avoid any penalties. 🙏*

Have a nice day, beautiful ✨🩷`;
}

export function msgCancellationNotice({ clientName, className, date, time }) {
  return `Hi ${clientName}, unfortunately your ${className} class on ${formatDateLong(date)} at ${formatTime(time)} has been cancelled. Your session has been returned to your package. Please contact us to reschedule.

— ${STUDIO_NAME}`;
}

export function msgLowSessions({ clientName, sessionsLeft }) {
  return `Hi ${clientName}, just a reminder you have ${sessionsLeft} session${sessionsLeft === 1 ? '' : 's'} left in your package. Let us know if you'd like to renew!

— ${STUDIO_NAME}`;
}

export function msgExpiringPackage({ clientName, expiryDate }) {
  return `Hi ${clientName}, your package expires on ${formatDateLong(expiryDate)}. Renew anytime to keep your spot!

— ${STUDIO_NAME}`;
}

export function msgWaitlistApproved({ clientName, className, date, time }) {
  return `Hi ${clientName}, good news — a spot has opened up in ${className} on ${formatDateLong(date)} at ${formatTime(time)}. You're confirmed!

— ${STUDIO_NAME}`;
}

export function msgPaymentReminder({ clientName, amount }) {
  return `Hi ${clientName}, just a friendly reminder of your pending payment of $${amount} for your Pilates package. Thank you!

— ${STUDIO_NAME}`;
}
