// Secondary Firebase app instance.
//
// When the admin creates a trainer (or another client) account, we need to
// call createUserWithEmailAndPassword without changing who's logged in on the
// primary app. The trick is to initialise a second app with the same config,
// run the create-user call on its Auth instance, then sign out from that
// secondary app. The primary app's session is untouched.
//
// Pattern: initialise lazily so we don't pay the cost unless an admin
// actually triggers a user-create flow.

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Same config object as primary — re-import from the canonical place.
import { firebaseConfig } from './config';

const SECONDARY_APP_NAME = 'pilatesvibes-admin-secondary';

function getSecondaryApp() {
  const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
  if (existing) return existing;
  return initializeApp(firebaseConfig, SECONDARY_APP_NAME);
}

export function getSecondaryAuth() {
  return getAuth(getSecondaryApp());
}
