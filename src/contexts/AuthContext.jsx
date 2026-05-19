import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizePhone } from '../utils/phone';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // firebase user
  const [role,        setRole]        = useState(null); // 'admin' | 'trainer' | 'client'
  const [profile,     setProfile]     = useState(null); // client or trainer profile doc
  const [profileId,   setProfileId]   = useState(null);
  const [loading,     setLoading]     = useState(true);

  // Lets us trigger a manual profile re-fetch after signup
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshProfile = () => setRefreshKey(k => k + 1);

  // ── 1. Listen to auth state ────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setCurrentUser(user));
    return () => unsub();
  }, []);

  // ── 2. Load role + profile whenever the auth user changes ─────
  // Uses a cancellation flag so a stale fetch can't overwrite fresh state
  // (important after signup where we refresh manually).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!currentUser) {
        if (!cancelled) {
          setRole(null);
          setProfile(null);
          setProfileId(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);

      try {
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (cancelled) return;

        if (!userSnap.exists()) {
          // Happens momentarily during signup before user doc exists.
          setRole(null); setProfile(null); setProfileId(null);
          return;
        }
        const userData = userSnap.data();

        let prof = null;
        if (userData.role === 'client' && userData.profileId) {
          const p = await getDoc(doc(db, 'clients', userData.profileId));
          if (cancelled) return;
          prof = p.exists() ? { id: p.id, ...p.data() } : null;
        } else if (userData.role === 'trainer' && userData.profileId) {
          const p = await getDoc(doc(db, 'trainers', userData.profileId));
          if (cancelled) return;
          prof = p.exists() ? { id: p.id, ...p.data() } : null;
        }

        if (cancelled) return;
        setRole(userData.role);
        setProfileId(userData.profileId || null);
        setProfile(prof);
      } catch (err) {
        console.error('AuthContext loadProfile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [currentUser, refreshKey]);

  // ── Sign up a new client (with phone-match linking) ────────────
  async function signupClient({ name, email, phone, password }) {
    const canonicalPhone = normalizePhone(phone);
    if (!canonicalPhone) throw new Error('Please enter a valid phone number.');

    // Create the auth user (also signs them in)
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // Check for an existing client profile with this phone
    const q = query(collection(db, 'clients'), where('phone', '==', canonicalPhone));
    const snap = await getDocs(q);

    let clientId;
    let linked = false;

    if (!snap.empty) {
      // Link to the first matching profile
      const existing = snap.docs[0];
      clientId = existing.id;
      await updateDoc(doc(db, 'clients', clientId), {
        userId:    uid,
        email:     email || existing.data().email || '',
        // Keep existing name unless the profile didn't have one
        name:      existing.data().name || name,
        updatedAt: serverTimestamp(),
      });
      linked = true;
    } else {
      // Brand-new client doc
      const newRef = doc(collection(db, 'clients'));
      clientId = newRef.id;
      await setDoc(newRef, {
        name,
        phone:    canonicalPhone,
        phoneRaw: phone,
        email:    email || '',
        birthday: '2000-01-01',
        notes:    '',
        pkg:                            null,
        pkgSessions:                    0,
        pkgTotalSessions:               0,
        pkgExpiry:                      null,
        pkgPurchaseDate:                null,
        pkgPrice:                       0,
        pkgDiscount:                    0,
        pkgPaid:                        false,
        pkgPaymentMethod:               null,
        pkgBookingsBeforeVerification:  0,
        isFrozen:    false,
        freezeStart: null,
        freezeEnd:   null,
        status:      'no-package',
        userId:      uid,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    }

    // Create the user/role mapping doc
    await setDoc(doc(db, 'users', uid), {
      role:      'client',
      profileId: clientId,
      email:     email || '',
      createdAt: serverTimestamp(),
    });

    // Force a fresh profile load now that the user doc exists
    refreshProfile();

    return { linked, clientId };
  }

  async function login(email, password)  { return signInWithEmailAndPassword(auth, email, password); }
  async function logout()                 { return signOut(auth); }
  async function resetPassword(email)     { return sendPasswordResetEmail(auth, email); }

  const value = {
    currentUser, role, profile, profileId, loading,
    signupClient, login, logout, resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
