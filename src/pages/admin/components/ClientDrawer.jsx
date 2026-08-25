import { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, doc, getDoc,
} from 'firebase/firestore';
import {
  X, Calendar, Phone, Mail, Cake,
  Edit2, Trash2, MessageCircle, CheckCircle, Snowflake, RefreshCw,
  Minus, Plus, Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, Badge, Field, Input, Select, Textarea, Tabs, T, EmptyState,
} from '../../../components/ui';
import { db } from '../../../firebase/config';
import { formatPhone } from '../../../utils/phone';
import { formatDateLong, formatTime } from '../../../utils/dates';
import { computeClientStatus, statusLabel, statusColors } from '../../../utils/status';
import { buildWhatsAppLink, msgPaymentReminder, msgLowSessions } from '../../../utils/whatsapp';
import { PRESET_PACKAGES } from '../../../utils/packages';

export default function ClientDrawer({ client, open, onClose, ops, customPackages = [] }) {
  const [tab, setTab] = useState('profile');
  useEffect(() => { if (open) setTab('profile'); }, [open, client?.id]);

  if (!open || !client) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(61,35,20,0.45)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <aside
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, height: '100%',
          background: T.card, display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(61,35,20,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <h2 style={{
              margin: 0, fontFamily: T.serif, fontWeight: 500,
              color: T.primary, fontSize: '1.6rem', lineHeight: 1.1,
            }}>{client.name}</h2>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
               <Badge {...statusColors(computeClientStatus(client))}>{statusLabel(computeClientStatus(client))}</Badge>
              {client.pkg && (
                <span style={{ fontSize: '0.84rem', color: T.muted }}>
                  {client.pkg} • {client.pkgUnlimited ? 'unlimited' : `${client.pkgSessions} left`}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.muted, padding: 4,
          }}><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 24px 0' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'profile',  label: 'Profile' },
              { value: 'history',  label: 'History' },
              { value: 'actions',  label: 'Actions' },
            ]}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {tab === 'profile' && <ProfileTab client={client} ops={ops} />}
          {tab === 'history' && <HistoryTab client={client} ops={ops} />}
          {tab === 'actions' && <ActionsTab client={client} ops={ops} customPackages={customPackages} />}
        </div>
      </aside>
    </div>
  );
}

// ── Profile tab ────────────────────────────────────────────────
function ProfileTab({ client, ops }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name:     client.name || '',
        phone:    client.phoneRaw || client.phone || '',
        email:    client.email || '',
        birthday: client.birthday || '2000-01-01',
        notes:    client.notes || '',
      });
    }
  }, [editing, client.id]);

  async function save() {
    setSaving(true);
    try {
      await ops.updateClient(client.id, form);
      toast.success('Profile updated.');
      setEditing(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    try {
      await ops.removeClient(client.id);
      toast.success('Client deleted.');
    } catch (e) { toast.error(e.message); }
  }

  if (editing) {
    return (
      <div style={{ paddingTop: 8 }}>
        <Field label="Name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
        </Field>
        <Field label="Birthday">
          <Input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
        </Field>
        <Field label="Notes">
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </Field>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <InfoRow icon={Phone}    label="Phone"        value={client.phone ? formatPhone(client.phone) : '—'} />
      <InfoRow icon={Mail}     label="Email"        value={client.email || '—'} />
      <InfoRow icon={Cake}     label="Birthday"     value={client.birthday || '—'} />
      <InfoRow icon={Calendar} label="Member since" value={client.createdAt?.toDate ? client.createdAt.toDate().toLocaleDateString() : '—'} />

      {client.notes && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: '0.74rem', textTransform: 'uppercase',
            letterSpacing: '0.08em', color: T.muted, marginBottom: 6,
          }}>Notes</div>
          <div style={{
            background: T.bg, padding: '12px 14px',
            borderRadius: 8, fontSize: '0.88rem', color: T.text,
            whiteSpace: 'pre-wrap',
          }}>{client.notes}</div>
        </div>
      )}

      {/* Package summary */}
      <h3 style={{
        fontFamily: T.serif, fontSize: '1.15rem', color: T.primary,
        fontWeight: 500, margin: '22px 0 10px',
      }}>Current Package</h3>

      {!client.pkg ? (
        <div style={{
          padding: '14px', background: T.bg, borderRadius: 8,
          fontSize: '0.88rem', color: T.faint,
        }}>No package assigned. Use the Actions tab to assign one.</div>
      ) : (
        <div style={{ background: T.bg, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.95rem', color: T.text, fontWeight: 500 }}>{client.pkg}</span>
            <span style={{ fontSize: '0.95rem', color: T.primary, fontWeight: 500 }}>
              ${client.pkgPrice ?? 0}
              {client.pkgDiscount > 0 && (
                <span style={{ fontSize: '0.75rem', color: T.warm, marginLeft: 6 }}>
                  (-${client.pkgDiscount})
                </span>
              )}
            </span>
          </div>
          <Mini label="Sessions left">{client.pkgUnlimited ? '∞ unlimited' : client.pkgSessions}</Mini>
          <Mini label="Total sessions">{client.pkgUnlimited ? '—' : client.pkgTotalSessions}</Mini>
          <Mini label="Purchased">{client.pkgPurchaseDate || '—'}</Mini>
          <Mini label="Expires">{client.pkgExpiry || '—'}</Mini>
          <Mini label="Payment">
            {client.pkgPaid
              ? <span style={{ color: T.olive, fontWeight: 500 }}>Paid ({client.pkgPaymentMethod})</span>
              : <span style={{ color: T.danger }}>Unpaid</span>}
          </Mini>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" icon={Edit2}  onClick={() => setEditing(true)}>Edit profile</Button>
        <Button variant="danger"    icon={Trash2} onClick={del}>Delete client</Button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: `1px solid ${T.borderSoft}`,
    }}>
      <Icon size={15} color={T.faint} />
      <div style={{ fontSize: '0.78rem', color: T.muted, minWidth: 90 }}>{label}</div>
      <div style={{ fontSize: '0.92rem', color: T.text, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Mini({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '3px 0' }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color: T.text }}>{children}</span>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────
function HistoryTab({ client, ops }) {
  const [bookings,    setBookings]    = useState([]);
  const [attendance,  setAttendance]  = useState([]);
  const [pkgHistory,  setPkgHistory]  = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubs = [];

    unsubs.push(onSnapshot(
      query(collection(db, 'bookings'), where('clientId', '==', client.id), orderBy('date', 'desc')),
      snap => { setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error(err); setLoading(false); }
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'attendance'), where('clientId', '==', client.id)),
      snap => setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error(err)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'clients', client.id, 'packageHistory'), orderBy('archivedAt', 'desc')),
      snap => setPkgHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error(err)
    ));

        unsubs.push(onSnapshot(
      query(collection(db, 'clients', client.id, 'sessionAdjustments'), orderBy('createdAt', 'desc')),
      snap => setAdjustments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.error(err)
    ));

    return () => unsubs.forEach(u => u());
  }, [client.id]);

  const attendanceByBooking = useMemo(() => {
    const m = {};
    attendance.forEach(a => { m[a.bookingId] = a; });
    return m;
  }, [attendance]);

  function bookingStatus(b) {
    if (b.status === 'cancelled') return 'cancelled';
    const att = attendanceByBooking[b.id];
    if (att?.status === 'no-show')  return 'no-show';
    if (att?.status === 'attended') return 'attended';
    return 'upcoming';
  }

  function statusBadge(s) {
    switch (s) {
      case 'attended':  return <Badge bg="#EEF3E6" fg={T.olive}>Attended</Badge>;
      case 'no-show':   return <Badge bg="#FBEFE3" fg={T.warm}>No-show</Badge>;
      case 'cancelled': return <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>;
      default:          return <Badge bg="#E3EAF3" fg="#3A5A8C">Upcoming</Badge>;
    }
  }

      async function handleMarkHistoryPaid(g, method) {
    if (!confirm(`Mark $${g.price ?? 0} as paid via ${method}? This logs income in Finance.`)) return;
    try {
      await ops.markPackageHistoryPaid(client.id, g.instanceId, method);
      toast.success('Marked as paid.');
    } catch (e) { toast.error(e.message); }
  }

  // Group bookings by the specific package they were made under —
  // current package + every archived (renewed/removed) package.
  const groups = useMemo(() => {
    const list = [];

    if (client.pkg) {
      list.push({
        instanceId:    client.currentPackageInstanceId || null,
        pkg:           client.pkg,
        purchaseDate:  client.pkgPurchaseDate,
        expiry:        client.pkgExpiry,
        paid:          client.pkgPaid,
        price:         client.pkgPrice,
        paymentMethod: client.pkgPaymentMethod,
        totalSessions: client.pkgTotalSessions,
        unlimited:     client.pkgUnlimited,
        current:       true,
      });
    }

    pkgHistory.forEach(h => {
      list.push({
        instanceId:    h.id,
        pkg:           h.pkg,
        purchaseDate:  h.pkgPurchaseDate,
        expiry:        h.pkgExpiry,
        paid:          h.pkgPaid,
        price:         h.pkgPrice,
        paymentMethod: h.pkgPaymentMethod,
        totalSessions: h.pkgTotalSessions,
        unlimited:     h.pkgUnlimited,
        endReason:     h.endReason,
        current:       false,
      });
    });

    const withBookings = list.map(g => ({
      ...g,
      bookings: bookings
        .filter(b => g.instanceId && b.packageInstanceId === g.instanceId)
        .sort((a, b2) => b2.date.localeCompare(a.date)),
    }));

    // Bookings made before this feature existed (no package link at all)
    const knownIds = new Set(list.map(g => g.instanceId).filter(Boolean));
    const legacyBookings = bookings
      .filter(b => !b.packageInstanceId || !knownIds.has(b.packageInstanceId))
      .sort((a, b2) => b2.date.localeCompare(a.date));

    if (legacyBookings.length) {
      withBookings.push({ instanceId: null, pkg: 'Before package tracking', legacy: true, bookings: legacyBookings });
    }

     return withBookings.filter(g => g.bookings.length > 0 || g.current || (!g.legacy && !g.paid));
  }, [client, pkgHistory, bookings]);

  if (loading) return <div style={{ color: T.faint, padding: 20 }}>Loading…</div>;
  if (!bookings.length && !pkgHistory.length) return <EmptyState icon={Calendar} title="No bookings yet" />;

  return (
    <div style={{ paddingTop: 8 }}>
      {groups.map(g => (
        <div key={g.instanceId || 'legacy'} style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 8, paddingBottom: 8, borderBottom: `2px solid ${T.border}`, gap: 10, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: '1.1rem', fontWeight: 500, color: T.primary }}>
                {g.pkg}
                {g.current && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: T.olive, fontWeight: 500 }}>CURRENT</span>}
              </div>
              {!g.legacy && (
                <div style={{ fontSize: '0.78rem', color: T.faint, marginTop: 2 }}>
                  {g.purchaseDate ? `Started ${g.purchaseDate}` : 'Start date unknown'}
                  {g.expiry ? ` · expires ${g.expiry}` : ''}
                  {' · '}{g.unlimited ? 'unlimited sessions' : `${g.totalSessions ?? '—'} sessions`}
                </div>
              )}
            </div>
            {!g.legacy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Badge bg={g.paid ? '#EEF3E6' : '#F5DDDD'} fg={g.paid ? T.olive : T.danger}>
                  {g.paid ? `Paid${g.paymentMethod ? ' · ' + g.paymentMethod : ''}` : 'Unpaid'}
                </Badge>
                {!g.paid && !g.current && g.instanceId && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => handleMarkHistoryPaid(g, 'Cash')}>Mark paid (Cash)</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleMarkHistoryPaid(g, 'Whish')}>Mark paid (Whish)</Button>
                  </>
                )}
              </div>
            )}
          </div>

          {g.bookings.length === 0 ? (
            <div style={{ fontSize: '0.84rem', color: T.faint, padding: '6px 2px' }}>No sessions booked under this package yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {g.bookings.map(b => {
                const st  = bookingStatus(b);
                const dim = st === 'cancelled';
                return (
                  <div key={b.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', borderRadius: 8,
                    background: dim ? 'transparent' : T.bg,
                    opacity: dim ? 0.5 : 1, gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9rem', fontWeight: dim ? 400 : 500, color: T.text,
                        textDecoration: dim ? 'line-through' : 'none', marginBottom: 2,
                      }}>
                        {b.className || b.name || 'Class'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: T.faint }}>
                        {formatDateLong(b.date)} · {formatTime(b.time)}
                      </div>
                    </div>
                    {statusBadge(st)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
            {adjustments.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: T.serif, fontSize: '1.1rem', fontWeight: 500, color: T.primary,
            marginBottom: 8, paddingBottom: 8, borderBottom: `2px solid ${T.border}`,
          }}>
            Manual Adjustments
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {adjustments.map(a => (
              <div key={a.id} style={{ padding: '10px 12px', background: T.bg, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 500, color: T.text }}>
                    {a.type === 'conduct' ? 'Session conducted (-1)' : 'Session returned (+1)'}
                    {a.pkg ? ` · ${a.pkg}` : ''}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: T.faint, whiteSpace: 'nowrap' }}>
                    {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : ''}
                  </span>
                </div>
                {a.note && <div style={{ fontSize: '0.82rem', color: T.muted, marginTop: 3 }}>{a.note}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Actions tab ────────────────────────────────────────────────
function ActionsTab({ client, ops, customPackages }) {
  const [pkgModal,      setPkgModal]      = useState(false);
  const [discountInput, setDiscountInput] = useState(client.pkgDiscount ?? 0);
  const [expiryInput,   setExpiryInput]   = useState(client.pkgExpiry || '');
  const [sessionNote,   setSessionNote]   = useState('');


  useEffect(() => { setDiscountInput(client.pkgDiscount ?? 0); }, [client.id, client.pkgDiscount]);
 useEffect(() => { setExpiryInput(client.pkgExpiry || ''); }, [client.id, client.pkgExpiry]);

  const wrap = async (label, fn) => {
    try { await fn(); toast.success(label); }
    catch (e) { toast.error(e.message); }
  };

  const allPackages = [...PRESET_PACKAGES, ...customPackages];

async function handleMarkPaid() {
    const method = client.pkgPaymentMethod;
    if (!method) {
      toast.error('Please choose a payment method (Cash or Whish) first.');
      return;
    }
    if (!['Cash', 'Whish'].includes(method)) {
      toast.error('Invalid payment method.');
      return;
    }
    if (!confirm(`Mark $${client.pkgPrice ?? 0} as paid via ${method}? This logs income in Finance.`)) return;
    await wrap('Marked as paid. Income logged.', () => ops.markPackagePaid(client, method));
  }

  const waLink = (msg) => buildWhatsAppLink(client.phone, msg);

  return (
    <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Package management */}
      <Section title="Package">
        {!client.pkg && <p style={{ color: T.faint, margin: '0 0 10px', fontSize: '0.86rem' }}>
          Assign a package to start tracking sessions.
        </p>}
<Row>
          <Button icon={Plus} onClick={() => setPkgModal(true)}>
            {client.pkg ? 'Change package' : 'Assign package'}
          </Button>
          {client.pkg && !client.pkgPaid && (
            <Button variant="olive" icon={CheckCircle} onClick={handleMarkPaid}>
              Mark as paid
            </Button>
          )}
          {client.pkg && (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                if (!confirm(`Remove ${client.name}'s package? This clears all session data and cannot be undone.`)) return;
                wrap('Package removed.', () => ops.removePackage(client.id));
              }}
            >
              Remove package
            </Button>
          )}
        </Row>

        {client.pkg && (
          <>
            <Row>
              {!client.isFrozen ? (
                <Button variant="secondary" icon={Snowflake} onClick={() => wrap('Package frozen.', () => ops.freezePackage(client.id))}>
                  Freeze package
                </Button>
              ) : (
                <Button variant="secondary" icon={RefreshCw} onClick={() => wrap('Package unfrozen.', () => ops.unfreezePackage(client))}>
                  Unfreeze (resume)
                </Button>
              )}
            </Row>

            <Row label="Discount ($)">
              <Input
                type="number" min={0} step="0.01"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                style={{ width: 100 }}
              />
              <Button variant="secondary"  onClick={() => wrap('Discount updated.', () => ops.setDiscount(client, Number(discountInput) || 0))}>
                Apply
              </Button>
            </Row>

            <Row label="Payment method">
              <Select
                style={{ width: 140 }}
                value={client.pkgPaymentMethod || ''}
                onChange={e => wrap('Payment method updated.', () => ops.setPaymentMethod(client.id, e.target.value || null))}
              >
                <option value="">—</option>
                <option value="Cash">Cash</option>
                <option value="Whish">Whish</option>
              </Select>
            </Row>
            <Row label="Expiry date">
              <Input
                type="date"
                value={expiryInput}
                onChange={e => setExpiryInput(e.target.value)}
                style={{ width: 160 }}
              />
              <Button
                variant="secondary"
                icon={Calendar}
                onClick={() => {
                  if (!expiryInput) { toast.error('Pick a date first.'); return; }
                  wrap('Expiry date updated.', () => ops.updateClient(client.id, { pkgExpiry: expiryInput }));
                }}
              >
                Update
              </Button>
            </Row>
          </>
        )}
      </Section>

      {/* Manual session adjustments */}
      {client.pkg && (
        <Section title="Sessions">
          <p style={{ margin: '0 0 10px', fontSize: '0.84rem', color: T.faint }}>
            Conducting a session manually deducts one outside of a class booking.
            Returning adds one back (use to reverse mistakes).
          </p>
          <Field label="Note (optional)">
            <Input
              value={sessionNote}
              onChange={e => setSessionNote(e.target.value)}
              placeholder="e.g. Makeup session for missed class"
            />
          </Field>
          <Row>
            <Button
              variant="secondary" icon={Minus} disabled={client.pkgUnlimited}
              onClick={async () => {
                await wrap('Session deducted.', () => ops.conductSession(client, sessionNote));
                setSessionNote('');
              }}
            >
              Conduct session (-1)
            </Button>
            <Button
              variant="secondary" icon={Plus} disabled={client.pkgUnlimited}
              onClick={async () => {
                await wrap('Session returned.', () => ops.returnSession(client, sessionNote));
                setSessionNote('');
              }}
            >
              Return session (+1)
            </Button>
          </Row>
        </Section>
      )}

      {/* Contact */}
      <Section title="Contact">
        {!client.phone ? (
          <p style={{ color: T.faint, fontSize: '0.86rem', margin: 0 }}>No phone number on file.</p>
        ) : (
          <Row>
            <Button
              variant="olive" icon={MessageCircle}
              onClick={() => window.open(waLink(''), '_blank')}
            >
              Open WhatsApp
            </Button>
            {!client.pkgPaid && client.pkg && (
              <Button
                variant="secondary" icon={MessageCircle}
                onClick={() => window.open(waLink(msgPaymentReminder({ clientName: client.name, amount: client.pkgPrice })), '_blank')}
              >
                Send payment reminder
              </Button>
            )}
            {client.status === 'low' && (
              <Button
                variant="secondary" icon={MessageCircle}
                onClick={() => window.open(waLink(msgLowSessions({ clientName: client.name, sessionsLeft: client.pkgSessions })), '_blank')}
              >
                Send low-sessions msg
              </Button>
            )}
          </Row>
        )}
      </Section>

      <AssignPackageModal
        open={pkgModal}
        onClose={() => setPkgModal(false)}
        client={client}
        ops={ops}
        allPackages={allPackages}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{
      background: T.bg, borderRadius: 12, padding: '14px 16px',
      border: `1px solid ${T.borderSoft}`,
    }}>
      <div style={{
        fontSize: '0.74rem', textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.muted, marginBottom: 12,
        fontWeight: 600,
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {label && <span style={{ fontSize: '0.82rem', color: T.muted, minWidth: 110 }}>{label}</span>}
      {children}
    </div>
  );
}

// ── Assign Package modal ───────────────────────────────────────
function AssignPackageModal({ open, onClose, client, ops, allPackages }) {
  const [selected, setSelected] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setDiscount(0);
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!selected) { toast.error('Pick a package.'); return; }
    setSaving(true);
    try {
      await ops.assignPackage(client.id, selected, { discount: Number(discount) || 0, purchaseDate });
      toast.success('Package assigned.');
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(61,35,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
          maxWidth: 540, width: '100%', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: T.serif, fontWeight: 500, color: T.primary, fontSize: '1.35rem' }}>
            Assign Package
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted }}><X size={20} /></button>
        </div>

        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {allPackages.map(p => {
              const isSelected = selected?.name === p.name;
              return (
                <button
                  key={p.id || p.name}
                  onClick={() => setSelected(p)}
                  style={{
                    background: isSelected ? T.primary : T.bg,
                    color:      isSelected ? T.bg : T.text,
                    border:     `1.5px solid ${isSelected ? T.primary : T.border}`,
                    borderRadius: 10, padding: '12px 14px',
                    textAlign: 'left', cursor: 'pointer',
                    fontFamily: T.sans,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{p.name}</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: 3 }}>
                    {p.unlimited ? '∞' : p.sessions} sess • ${p.price} • {p.durationDays || '—'}d
                  </div>
                </button>
              );
            })}
          </div>

          <Field label="Purchase date">
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Discount (USD)" hint="Subtracted from package price before income is logged.">
            <Input type="number" min={0} step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} />
          </Field>

          {selected && (
            <div style={{
              background: T.bg, padding: '12px 14px', borderRadius: 8,
              fontSize: '0.86rem', color: T.text,
            }}>
              Final price: <strong>${Math.max(0, (selected.price || 0) - (Number(discount) || 0))}</strong>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: T.bg }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Assign'}</Button>
        </div>
      </div>
    </div>
  );
}
