import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, query, orderBy,
  doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { computeClientStatus, computeExpiry, todayString } from '../utils/status';
import { normalizePhone } from '../utils/phone';
import { isClientSelectable, getPresetByName } from '../utils/packages';


// Snapshot the client's current package into clients/{id}/packageHistory
// before assignPackage/removePackage overwrites it. Keeps sessions, paid
// status, dates — everything — tied to that specific package instance.
async function archiveCurrentPackage(clientId, cli, endReason) {
  if (!cli.pkg) return; // nothing to archive
  const instanceId = cli.currentPackageInstanceId
    || doc(collection(db, 'clients', clientId, 'packageHistory')).id;
  await setDoc(doc(db, 'clients', clientId, 'packageHistory', instanceId), {
    pkg:              cli.pkg,
    pkgTotalSessions: cli.pkgTotalSessions ?? 0,
    pkgSessionsLeft:  cli.pkgUnlimited ? null : (cli.pkgSessions ?? 0),
    pkgUnlimited:     !!cli.pkgUnlimited,
    pkgPrice:         cli.pkgPrice ?? 0,
    pkgDiscount:      cli.pkgDiscount ?? 0,
    pkgPaid:          !!cli.pkgPaid,
    pkgPaymentMethod: cli.pkgPaymentMethod || null,
    pkgPurchaseDate:  cli.pkgPurchaseDate || null,
    pkgExpiry:        cli.pkgExpiry || null,
    endReason, // 'renewed' | 'removed'
    archivedAt: serverTimestamp(),
  });
}

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

    const snap = await getDoc(doc(db, 'clients', clientId));
    const cli  = snap.exists() ? snap.data() : {};

    // Archive whatever package they had before this overwrites it
    await archiveCurrentPackage(clientId, cli, 'renewed');
    const newInstanceId = doc(collection(db, 'clients', clientId, 'packageHistory')).id;

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
      currentPackageInstanceId:       newInstanceId,
    };
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

     const newInstanceId = doc(collection(db, 'clients', clientId, 'packageHistory')).id;


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
       currentPackageInstanceId:       newInstanceId,
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


    // Mark an ARCHIVED (past/renewed) package as paid — for packages that
  // were renewed over before payment was collected.
  async function markPackageHistoryPaid(clientId, instanceId, method) {
    if (!['Cash', 'Whish'].includes(method)) throw new Error('Invalid payment method.');
    const ref  = doc(db, 'clients', clientId, 'packageHistory', instanceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Package record not found.');
    const h = snap.data();
    if (h.pkgPaid) throw new Error('Already marked as paid.');

    const clientSnap = await getDoc(doc(db, 'clients', clientId));
    const clientName = clientSnap.exists() ? clientSnap.data().name : '';
    const today = todayString();

    await addDoc(collection(db, 'expenses'), {
      isIncome:    true,
      category:    'Membership',
      amount:      h.pkgPrice || 0,
      method,
      date:        today,
      month:       today.slice(0, 7),
      description: `${clientName} — ${h.pkg} (past package)`,
      clientId,
      createdAt:   serverTimestamp(),
    });

    await updateDoc(ref, { pkgPaid: true, pkgPaymentMethod: method });
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

    async function conductSession(client, note = '') {
    if (!client.pkg)         throw new Error('Client has no package.');
    if (client.pkgUnlimited) return;
    if ((client.pkgSessions ?? 0) <= 0) throw new Error('No sessions left.');
    const merge = { pkgSessions: client.pkgSessions - 1 };
    merge.status = computeClientStatus({ ...client, ...merge });
    await updateDoc(doc(db, 'clients', client.id), { ...merge, updatedAt: serverTimestamp() });
    await addDoc(collection(db, 'clients', client.id, 'sessionAdjustments'), {
      type: 'conduct',
      note: note || '',
      pkg:  client.pkg,
      packageInstanceId: client.currentPackageInstanceId || null,
      createdAt: serverTimestamp(),
    });
  }

  async function returnSession(client, note = '') {
    if (client.pkgUnlimited) return;
    const merge = { pkgSessions: (client.pkgSessions || 0) + 1 };
    merge.status = computeClientStatus({ ...client, ...merge });
    await updateDoc(doc(db, 'clients', client.id), { ...merge, updatedAt: serverTimestamp() });
    await addDoc(collection(db, 'clients', client.id, 'sessionAdjustments'), {
      type: 'return',
      note: note || '',
      pkg:  client.pkg,
      packageInstanceId: client.currentPackageInstanceId || null,
      createdAt: serverTimestamp(),
    });
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
  async function removePackage(clientId) {
    const snap = await getDoc(doc(db, 'clients', clientId));
    const cli  = snap.exists() ? snap.data() : {};
    await archiveCurrentPackage(clientId, cli, 'removed');

    await updateDoc(doc(db, 'clients', clientId), {
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
      isFrozen:                       false,
      freezeStart:                    null,
      freezeEnd:                      null,
      status:                         'no-package',
      currentPackageInstanceId:       null,
      updatedAt:                      serverTimestamp(),
    });
  }

  return {
    clients, loading, error,
    addClient, updateClient, removeClient,
    assignPackage, selfAssignPackage, markPackagePaid, markPackageHistoryPaid, removePackage,
    freezePackage, unfreezePackage,
    conductSession, returnSession,
    setDiscount, setPaymentMethod,
  };
}
