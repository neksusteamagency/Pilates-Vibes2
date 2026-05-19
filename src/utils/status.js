// Single source of truth for client status, computed from package state.
//   'no-package' | 'frozen' | 'expired' | 'low' | 'expiring' | 'active'

const LOW_SESSIONS_THRESHOLD  = 2;   // ≤ 2 sessions remaining = "low"
const EXPIRING_DAYS_THRESHOLD = 5;   // ≤ 5 days until expiry  = "expiring"

export function computeClientStatus(client) {
  if (!client?.pkg || client.pkg === 'No Package') return 'no-package';
  if (client.isFrozen) return 'frozen';

  if (client.pkgExpiry) {
    const today = todayString();
    if (client.pkgExpiry < today) return 'expired';

    const daysLeft = daysBetween(today, client.pkgExpiry);
    if (daysLeft >= 0 && daysLeft <= EXPIRING_DAYS_THRESHOLD) return 'expiring';
  }

  // Unlimited packages never go "low" — only expire
  if (client.pkgUnlimited) return 'active';

  if ((client.pkgSessions ?? 0) <= LOW_SESSIONS_THRESHOLD) return 'low';

  return 'active';
}

// Compute an expiry date string from a purchase date + N days. Default 30.
export function computeExpiry(purchaseDateString, daysValid = 30) {
  const d = new Date(purchaseDateString + 'T00:00:00');
  d.setDate(d.getDate() + daysValid);
  return d.toISOString().slice(0, 10);
}

// Pretty-print status as a label for UI badges
export function statusLabel(status) {
  return {
    'no-package': 'No Package',
    'frozen':     'Frozen',
    'expired':    'Expired',
    'low':        'Low Sessions',
    'expiring':   'Expiring Soon',
    'active':     'Active',
  }[status] || status;
}

// Color tokens for status badges
export function statusColors(status) {
  switch (status) {
    case 'active':     return { bg: '#EEF3E6', fg: '#4E6A2E' };
    case 'low':        return { bg: '#FBEFE3', fg: '#A0673A' };
    case 'expiring':   return { bg: '#FBEFE3', fg: '#A0673A' };
    case 'expired':    return { bg: '#F5DDDD', fg: '#8C3A3A' };
    case 'frozen':     return { bg: '#E3EAF3', fg: '#3A5A8C' };
    case 'no-package':
    default:           return { bg: '#EFE9DD', fg: '#6B5744' };
  }
}

// ── Helpers ─────────────────────────────────────────────────────

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromYMD, toYMD) {
  const a = new Date(fromYMD + 'T00:00:00');
  const b = new Date(toYMD + 'T00:00:00');
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}
