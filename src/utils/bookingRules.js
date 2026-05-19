// Booking-eligibility rules. One source of truth for "can this client book
// this class?", used by both the client UI (preflight checks before opening
// the booking dialog) and the booking transaction itself (defense in depth).
//
// Returns { ok: boolean, reason: string|null }.

import { todayString, nowTime, isWithin12Hours } from './dates';

const TWO_WEEKS_DAYS               = 14;
const UNPAID_BOOKING_LIMIT         = 1;             // can book this many times before payment
const CLIENT_SELF_CUTOFF_MINUTES   = 60;            // <1h before class: client can't self-book

export function checkBookingEligibility({ client, classRef, isClientSelf = false }) {
  // ── Class-side checks ───────────────────────────────────────
  if (!classRef) return fail('Class not found.');
  if (classRef.status === 'cancelled') return fail('This class has been cancelled.');

  if ((classRef.bookedCount || 0) >= (classRef.capacity || 6)) {
    return fail('Class is full. Join the waitlist instead.');
  }

  // Forward-only: cannot book a class that already started (everyone)
  const today = todayString();
  if (classRef.date < today) return fail('This class has already passed.');
  if (classRef.date === today && classRef.time <= nowTime()) {
    return fail('This class has already started.');
  }

  // Client-side: extra restrictions clients face but admins can override
  if (isClientSelf) {
    // 2-week window
    const maxDate = new Date(today + 'T00:00:00');
    maxDate.setDate(maxDate.getDate() + TWO_WEEKS_DAYS);
    const maxYMD = maxDate.toISOString().slice(0, 10);
    if (classRef.date > maxYMD) {
      return fail(`Bookings open only ${TWO_WEEKS_DAYS} days ahead.`);
    }

    // 1-hour cutoff before class start (today only — future days are fine)
    if (classRef.date === today) {
      const minutesUntil = minutesUntilClass(classRef.date, classRef.time);
      if (minutesUntil < CLIENT_SELF_CUTOFF_MINUTES) {
        return fail(`Too close to start — bookings close 1 hour before class.`);
      }
    }
  }

  // ── Client-side checks ──────────────────────────────────────
  if (!client)                return fail('No client.');
  if (!client.pkg)            return fail('No active package — buy one to start booking.');
  if (client.isFrozen)        return fail('Your package is frozen.');
  if (client.pkgExpiry && client.pkgExpiry < today) return fail('Your package has expired.');
  if (!client.pkgUnlimited && (client.pkgSessions ?? 0) <= 0) {
    return fail('No sessions remaining in your package.');
  }

  // 1 booking before payment is verified
  if (!client.pkgPaid && (client.pkgBookingsBeforeVerification ?? 0) >= UNPAID_BOOKING_LIMIT) {
    return fail(`Payment not yet verified. You can only book ${UNPAID_BOOKING_LIMIT} class before payment confirmation.`);
  }

  return ok();
}

// Checks whether a client can cancel their own booking — admins can always cancel.
export function checkSelfCancellation({ booking }) {
  if (!booking)                       return fail('Booking not found.');
  if (booking.status === 'cancelled') return fail('Already cancelled.');
  if (isWithin12Hours(booking.date, booking.time)) {
    return fail('Cannot cancel within 12 hours of class. Contact the studio.');
  }
  return ok();
}

// ── Helpers ────────────────────────────────────────────────────

function minutesUntilClass(date, time) {
  const start = new Date(`${date}T${time}:00`);
  return Math.floor((start.getTime() - Date.now()) / 60000);
}

function ok()         { return { ok: true,  reason: null }; }
function fail(reason) { return { ok: false, reason       }; }
