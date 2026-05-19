// Date and time helpers used by Schedule, Attendance, and elsewhere.
// All dates are 'YYYY-MM-DD' strings, all times are 'HH:mm' strings.

export const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LABELS_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Class duration in minutes — every class is 1 hour.
export const CLASS_DURATION_MINUTES = 60;

// Internal day-of-week (0=Mon … 6=Sun) — easier for a "Mon → Sun" grid
// than JS's native 0=Sun … 6=Sat.
function jsDayToMonStart(d) { return (d.getDay() + 6) % 7; }

// Half-hour slots from 09:00 to 21:00 inclusive — last class starts at 9pm.
// 25 slots: 09:00, 09:30, 10:00, …, 21:00.
export const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 9; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 21) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
})();

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function parseYMD(ymd) {
  return new Date(ymd + 'T00:00:00');
}

export function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfWeek(dateOrYMD) {
  const d = typeof dateOrYMD === 'string' ? parseYMD(dateOrYMD) : new Date(dateOrYMD);
  d.setHours(0, 0, 0, 0);
  const dow = jsDayToMonStart(d);
  d.setDate(d.getDate() - dow);
  return d;
}

export function weekDates(anchorDate) {
  const monday = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatYMD(d);
  });
}

export function addDays(ymd, n) {
  const d = parseYMD(ymd);
  d.setDate(d.getDate() + n);
  return formatYMD(d);
}

export function dayOfWeek(ymd) {
  return jsDayToMonStart(parseYMD(ymd));
}

// e.g. 'Mon, Jan 5' — day name included (short)
export function formatDateShort(ymd) {
  const d = parseYMD(ymd);
  return `${DAY_LABELS_SHORT[jsDayToMonStart(d)]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

// e.g. 'Monday, January 5, 2026' — day name included (long)
export function formatDateLong(ymd) {
  return parseYMD(ymd).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// True iff the class start time is already in the past (date + time both)
export function isClassStarted(date, time) {
  const today = todayString();
  if (date < today) return true;
  if (date > today) return false;
  return time <= nowTime();
}

// True iff there are < 12 hours between now and class start
export function isWithin12Hours(date, time) {
  const start = new Date(`${date}T${time}:00`);
  return (start.getTime() - Date.now()) < 12 * 60 * 60 * 1000;
}

// Convert 'HH:mm' to minutes-since-midnight
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Convert minutes-since-midnight back to 'HH:mm'
export function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Add N minutes to a 'HH:mm' string
export function addMinutes(hhmm, n) {
  return minutesToTime(timeToMinutes(hhmm) + n);
}

// True iff two 1-hour classes overlap when started at the given times.
// e.g. classOverlaps('09:30', '10:00') === true (9:30–10:30 vs 10:00–11:00)
export function classOverlaps(timeA, timeB, durationMinutes = CLASS_DURATION_MINUTES) {
  const startA = timeToMinutes(timeA);
  const startB = timeToMinutes(timeB);
  const endA   = startA + durationMinutes;
  const endB   = startB + durationMinutes;
  return startA < endB && startB < endA;
}