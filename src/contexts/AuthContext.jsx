import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc, getDoc, collection, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { normalizePhone } from '../utils/phone';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role,        setRole]        = useState(null);
  const [profile,     setProfile]     = useState(null);
  const [profileId,   setProfileId]   = useState(null);
  const [loading,     setLoading]     = useState(true);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshProfile = () => setRefreshKey(k => k + 1);

  // ── 1. Listen to auth state ────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setCurrentUser(user));
    return () => unsub();
  }, []);

  // ── 2. Load role + profile whenever the auth user changes ─────
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

  // ── Sign up a new client (atomic phone-match linking) ──────────
  async function signupClient({ name, email, phone, password }) {
    const canonicalPhone = normalizePhone(phone);
    if (!canonicalPhone) throw new Error('Please enter a valid phone number.');

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    try {
      let linked   = false;
      let clientId = null;

      await runTransaction(db, async (tx) => {
        linked   = false;
        clientId = null;

        const idxRef = doc(db, 'phoneIndex', canonicalPhone);
        const idx    = await tx.get(idxRef);

        if (idx.exists()) {
          // Phone already known → link to that profile
          const data = idx.data();
          if (data.userId && data.userId !== uid) {
            throw new Error('This phone number already has an account. Please sign in instead.');
          }
          clientId = data.clientId;
          tx.update(doc(db, 'clients', clientId), {
            userId:    uid,
            email:     email || '',
            updatedAt: serverTimestamp(),
          });
          tx.update(idxRef, { userId: uid });
          linked = true;
        } else {
          // New phone → brand-new client profile
          const newRef = doc(collection(db, 'clients'));
          clientId = newRef.id;
          tx.set(newRef, {
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
            pkgUnlimited:                   false,
            isFrozen:    false,
            freezeStart: null,
            freezeEnd:   null,
            status:      'no-package',
            userId:      uid,
            createdAt:   serverTimestamp(),
            updatedAt:   serverTimestamp(),
          });
          tx.set(idxRef, { clientId, userId: uid });
        }

        tx.set(doc(db, 'users', uid), {
          role:      'client',
          profileId: clientId,
          email:     email || '',
          createdAt: serverTimestamp(),
        });
      });

      refreshProfile();
      return { linked, clientId };
    } catch (err) {
      // Don't leave an orphan login behind if linking failed
      await cred.user.delete().catch(() => {});
      throw err;
    }
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