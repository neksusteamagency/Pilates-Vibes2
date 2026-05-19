// Preset packages, exactly per the requirements spec.
// All have a 30-day expiry. Custom packages are stored in Firestore
// (collection: customPackages) and can have any duration.

export const PRESET_PACKAGES = [
  {
    id:            'first',
    name:          'First Class',
    sessions:      1,
    price:         10,
    durationDays:  30,
    firstTimeOnly: true,
    preset:        true,
  },
  { id: 'single',    name: 'Single Class',       sessions: 1,  price: 15,  durationDays: 30, preset: true },
  { id: '4pack',     name: '4-Pack',             sessions: 4,  price: 55,  durationDays: 30, preset: true },
  { id: '8pack',     name: '8-Pack',             sessions: 8,  price: 95,  durationDays: 30, preset: true },
  { id: '12pack',    name: '12-Pack',            sessions: 12, price: 130, durationDays: 30, preset: true },
  {
    id:           'unlimited',
    name:         'Monthly Unlimited',
    sessions:     0,
    price:        160,
    durationDays: 30,
    unlimited:    true,
    preset:       true,
  },
];

// Packages a client may select for themselves on their profile.
// Excludes "First Class" (admin-only, for new walk-ins). Custom packages
// (stored in Firestore) are admin-assignment only and are not in this list.
export const CLIENT_SELECTABLE_PACKAGES = PRESET_PACKAGES.filter(
  p => !p.firstTimeOnly
);

// Set of allowed package names for client self-assignment — used to validate
// that a client can't manipulate the package they pick.
export const CLIENT_SELECTABLE_PACKAGE_NAMES = new Set(
  CLIENT_SELECTABLE_PACKAGES.map(p => p.name)
);

export function isClientSelectable(pkgName) {
  return CLIENT_SELECTABLE_PACKAGE_NAMES.has(pkgName);
}

// Find a package by name (preset OR custom). Used when looking up a client's
// current package to display details, capacity etc.
export function findPackage(name, customPackages = []) {
  if (!name) return null;
  return (
    PRESET_PACKAGES.find(p => p.name === name) ||
    customPackages.find(p => p.name === name) ||
    null
  );
}

// Lookup a preset package by name, returning the canonical preset definition
// (price, sessions, etc). Used to enforce that client self-assigned packages
// have correct, server-side-validated prices.
export function getPresetByName(name) {
  return PRESET_PACKAGES.find(p => p.name === name) || null;
}
