import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, addDoc, updateDoc, deleteDoc, getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { computeClientStatus, computeExpiry, todayString } from '../utils/status';
import { normalizePhone } from '../utils/phone';
import { isClientSelectable, getPresetByName } from '../utils/packages';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name'));
    const unsub = onSnapshot(q,
      snap => {
        setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => { console.error('useClients:', err); setError(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  async function addClient(data) {
    const canonical = normalizePhone(data.phone);
    return await addDoc(collection(db, 'clients'), {
      name:      data.name,
      phone:     canonical,
      phoneRaw:  data.phone || '',
      email:     data.email || '',
      birthday:  data.birthday || '2000-01-01',
      notes:     data.notes || '',
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
      userId:      null,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });
  }

  async function updateClient(id, data) {
    const merge = { ...data };
    if (data.phone !== undefined) {
      merge.phone    = normalizePhone(data.phone);
      merge.phoneRaw = data.phone;
    }
    const snap = await getDoc(doc(db, 'clients', id));
    if (snap.exists()) {
      merge.status = computeClientStatus({ ...snap.data(), ...merge });
    }
    await updateDoc(doc(db, 'clients', id), { ...merge, updatedAt: serverTimestamp() });
  }

  async function removeClient(id) {
    await deleteDoc(doc(db, 'clients', id));
  }

  // Admin path — assigns ANY package (preset OR custom) with optional discount
  async function assignPackage(clientId, pkg, opts = {}) {
    const purchaseDate = opts.purchaseDate || todayString();
    const expiry       = pkg.durationDays
      ? computeExpiry(purchaseDate, pkg.durationDays)
      : opts.expiry || null;
    const discount = opts.discount || 0;
    const price    = Math.max(0, (pkg.price || 0) - discount);

    const merge = {
      pkg:                            pkg.name,
      pkgSessions:                    pkg.sessions || 0,
      pkgTotalSessions:               pkg.sessions || 0,
      pkgExpiry:                      expiry,
      pkgPurchaseDate:                purchaseDate,
      pkgPrice:                       price,
      pkgDiscount:                    discount,
      pkgPaid:                        false,
      pkgPaymentMethod:               null,
      pkgBookingsBeforeVerification:  0,
      pkgUnlimited:                   !!pkg.unlimited,
      isFrozen:                       false,
      freezeStart:                    null,
      freezeEnd:                      null,
    };
    const snap = await getDoc(doc(db, 'clients', clientId));
    if (snap.exists()) {
      merge.status = computeClientStatus({ ...snap.data(), ...merge });
    }
    await updateDoc(doc(db, 'clients', clientId), { ...merge, updatedAt: serverTimestamp() });
  }

  // ── Client self-assignment ─────────────────────────────────────
  //
  // Strict path used from the client profile page. Validates:
  //   • Client currently has NO package (admins handle renewals)
  //   • Package name is in the client-selectable allowlist (no First Class,
  //     no custom packages)
  //   • Price/sessions/duration come from the canonical preset, not the client
  //
  // Sets the package as unpaid. The 1-booking-before-paid rule still applies.
  async function selfAssignPackage(clientId, pkgName) {
    if (!isClientSelectable(pkgName)) {
      throw new Error('That package isn\'t available for self-selection.');
    }
    const preset = getPresetByName(pkgName);
    if (!preset) throw new Error('Unknown package.');

    const snap = await getDoc(doc(db, 'clients', clientId));
    if (!snap.exists()) throw new Error('Client profile not found.');
    const cli = snap.data();

    // Block if they already have ANY package — admin handles renewals
    if (cli.pkg) {
      throw new Error('You already have a package. Please contact the studio to renew or change packages.');
    }

    const today  = todayString();
    const expiry = computeExpiry(today, preset.durationDays || 30);

    const merge = {
      pkg:                            preset.name,
      pkgSessions:                    preset.sessions || 0,
      pkgTotalSessions:               preset.sessions || 0,
      pkgExpiry:                      expiry,
      pkgPurchaseDate:                today,
      pkgPrice:                       preset.price,   // <- from preset, not client
      pkgDiscount:                    0,
      pkgPaid:                        false,
      pkgPaymentMethod:               null,
      pkgBookingsBeforeVerification:  0,
      pkgUnlimited:                   !!preset.unlimited,
      isFrozen:                       false,
      freezeStart:                    null,
      freezeEnd:                      null,
    };
    merge.status = computeClientStatus({ ...cli, ...merge });

    await updateDoc(doc(db, 'clients', clientId), {
      ...merge,
      updatedAt: serverTimestamp(),
    });
  }

  async function markPackagePaid(client, method) {
    if (!client?.pkg) throw new Error('Client has no package to pay for.');
    if (!['Cash', 'Whish'].includes(method)) throw new Error('Invalid payment method.');

    const today  = todayString();
    const amount = client.pkgPrice || 0;

    await addDoc(collection(db, 'expenses'), {
      isIncome:    true,
      category:    'Membership',
      amount,
      method,
      date:        today,
      month:       today.slice(0, 7),
      description: `${client.name} — ${client.pkg}`,
      clientId:    client.id,
      createdAt:   serverTimestamp(),
    });

    await updateDoc(doc(db, 'clients', client.id), {
      pkgPaid:          true,
      pkgPaymentMethod: method,
      updatedAt:        serverTimestamp(),
    });
  }

  async function freezePackage(clientId) {
    await updateDoc(doc(db, 'clients', clientId), {
      isFrozen:    true,
      freezeStart: todayString(),
      freezeEnd:   null,
      status:      'frozen',
      updatedAt:   serverTimestamp(),
    });
  }

  async function unfreezePackage(client) {
    if (!client.isFrozen || !client.freezeStart) {
      await updateDoc(doc(db, 'clients', client.id), { isFrozen: false, updatedAt: serverTimestamp() });
      return;
    }
    const today = todayString();
    const daysFrozen = Math.max(0, Math.ceil(
      (new Date(today) - new Date(client.freezeStart)) / (1000 * 60 * 60 * 24)
    ));
    let newExpiry = client.pkgExpiry;
    if (client.pkgExpiry && daysFrozen > 0) {
      const d = new Date(client.pkgExpiry + 'T00:00:00');
      d.setDate(d.getDate() + daysFrozen);
      newExpiry = d.toISOString().slice(0, 10);
    }
    const merge = {
      isFrozen:    false,
      freezeEnd:   today,
      pkgExpiry:   newExpiry,
      updatedAt:   serverTimestamp(),
    };
    merge.status = computeClientStatus({ ...client, ...merge });
    await updateDoc(doc(db, 'clients', client.id), merge);
  }

  async function conductSession(client) {
    if (!client.pkg)         throw new Error('Client has no package.');
    if (client.pkgUnlimited) return;
    if ((client.pkgSessions ?? 0) <= 0) throw new Error('No sessions left.');
    const merge = { pkgSessions: client.pkgSessions - 1 };
    merge.status = computeClientStatus({ ...client, ...merge });
    await updateDoc(doc(db, 'clients', client.id), { ...merge, updatedAt: serverTimestamp() });
  }

  async function returnSession(client) {
    if (client.pkgUnlimited) return;
    const merge = { pkgSessions: (client.pkgSessions || 0) + 1 };
    merge.status = computeClientStatus({ ...client, ...merge });
    await updateDoc(doc(db, 'clients', client.id), { ...merge, updatedAt: serverTimestamp() });
  }

  async function setDiscount(client, discount) {
    const original = (client.pkgPrice || 0) + (client.pkgDiscount || 0);
    const newPrice = Math.max(0, original - discount);
    await updateDoc(doc(db, 'clients', client.id), {
      pkgDiscount: discount,
      pkgPrice:    newPrice,
      updatedAt:   serverTimestamp(),
    });
  }

  async function setPaymentMethod(clientId, method) {
    await updateDoc(doc(db, 'clients', clientId), {
      pkgPaymentMethod: method,
      updatedAt:        serverTimestamp(),
    });
  }

  return {
    clients, loading, error,
    addClient, updateClient, removeClient,
    assignPackage, selfAssignPackage, markPackagePaid,
    freezePackage, unfreezePackage,
    conductSession, returnSession,
    setDiscount, setPaymentMethod,
  };
}
