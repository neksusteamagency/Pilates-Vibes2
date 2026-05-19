// Lebanese phone number normalization.
// All variations of the same number must reduce to one canonical form so that
// account-linking by phone works reliably:
//
//   "70 111 222"      → "70111222"
//   "70111222"        → "70111222"
//   "070111222"       → "70111222"
//   "+961 70 111 222" → "70111222"
//   "00961 70111222"  → "70111222"
//   "961-70-111-222"  → "70111222"
//
// Mobile numbers are 8 digits. Landlines are 7. We strip the country code
// (+961 / 00961) and the national trunk prefix (0) leaving just the local part.

export function normalizePhone(input) {
  if (!input) return '';
  let s = String(input).trim();

  // Remove all whitespace, dashes, parentheses, dots
  s = s.replace(/[\s\-().]/g, '');

  // Strip a leading +
  if (s.startsWith('+')) s = s.slice(1);

  // Strip country code variants (longest match first)
  if (s.startsWith('00961'))     s = s.slice(5);
  else if (s.startsWith('961'))  s = s.slice(3);

  // Strip national trunk prefix
  if (s.startsWith('0')) s = s.slice(1);

  // Keep digits only
  s = s.replace(/\D/g, '');

  return s;
}

// Pretty-print a canonical Lebanese number as "+961 XX XXX XXX"
export function formatPhone(canonical) {
  if (!canonical) return '';
  const c = String(canonical);
  if (c.length === 8) return `+961 ${c.slice(0, 2)} ${c.slice(2, 5)} ${c.slice(5)}`;
  if (c.length === 7) return `+961 ${c.slice(0, 1)} ${c.slice(1, 4)} ${c.slice(4)}`;
  return `+961 ${c}`;
}

// 8-digit mobile or 7-digit landline
export function isValidLebanesePhone(phone) {
  const n = normalizePhone(phone);
  return /^[0-9]{7,8}$/.test(n);
}
