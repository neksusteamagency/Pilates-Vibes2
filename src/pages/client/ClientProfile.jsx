import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  User, Phone as PhoneIcon, Mail, Cake, Calendar,
  Infinity as InfinityIcon, AlertCircle, Package as PackageIcon,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Badge, Button, Modal, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { formatPhone } from '../../utils/phone';
import { statusLabel, statusColors } from '../../utils/status';
import { CLIENT_SELECTABLE_PACKAGES } from '../../utils/packages';

export default function ClientProfile() {
  const { currentUser } = useAuth();
  const { selfAssignPackage } = useClients();
  const [client, setClient]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'clients'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q,
      snap => {
        setClient(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
        setLoading(false);
      },
      err => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, [currentUser?.uid]);

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <AlertCircle size={36} style={{ marginBottom: 12, opacity: 0.5, color: T.faint }} />
            <div style={{ fontFamily: T.serif, fontSize: '1.2rem', color: T.primary }}>
              Profile not linked
            </div>
            <div style={{ fontSize: '0.88rem', color: T.faint, marginTop: 6 }}>
              Your account exists but isn't linked to a client profile yet. Please contact the studio.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      <PageHeader
        title={`Hello, ${client.name.split(' ')[0]}`}
        subtitle="Your studio profile"
      />

      {/* Status banner */}
      <div style={{ marginBottom: 22 }}>
        <Badge {...statusColors(client.status)} style={{ padding: '6px 14px', fontSize: '0.86rem' }}>
          {statusLabel(client.status)}
        </Badge>
      </div>

      {/* Package card OR picker prompt */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.4rem', color: T.primary,
        fontWeight: 500, margin: '8px 0 12px',
      }}>{client.pkg ? 'Current Package' : 'Choose Your Package'}</h2>

      {!client.pkg ? (
        <Card style={{ marginBottom: 28, padding: 0 }}>
          <PackagePicker
            onPick={() => setPickerOpen(true)}
          />
        </Card>
      ) : (
        <Card style={{ marginBottom: 28, padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: '1.8rem', color: T.primary, fontWeight: 500, lineHeight: 1.1 }}>
                {client.pkg}
              </div>
              <div style={{ fontSize: '0.9rem', color: T.muted, marginTop: 4 }}>
                {client.pkgUnlimited ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <InfinityIcon size={14} /> unlimited sessions
                  </span>
                ) : (
                  <>
                    <strong style={{ color: T.text, fontSize: '1.05rem' }}>{client.pkgSessions}</strong>
                    {' '} of {client.pkgTotalSessions} sessions remaining
                  </>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted }}>
                Expires
              </div>
              <div style={{ fontSize: '1.05rem', color: T.text, fontWeight: 500 }}>
                {client.pkgExpiry || '—'}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            background: client.pkgPaid ? '#EEF3E6' : '#FBEFE3',
            color: client.pkgPaid ? T.olive : T.warm,
            fontSize: '0.86rem',
          }}>
            {client.pkgPaid
              ? `✓ Paid (${client.pkgPaymentMethod || '—'})`
              : `⚠ Payment pending — please pay $${client.pkgPrice ?? 0} at your next visit.`}
          </div>

          {client.isFrozen && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8,
              background: '#E3EAF3', color: '#3A5A8C', fontSize: '0.86rem',
            }}>
              ❄ Package frozen since {client.freezeStart || '—'}. Bookings paused until you resume.
            </div>
          )}

          <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: T.faint }}>
            To renew, change, or freeze your package, please contact the studio.
          </p>
        </Card>
      )}

      {/* Personal info */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.4rem', color: T.primary,
        fontWeight: 500, margin: '8px 0 12px',
      }}>About You</h2>

      <Card>
        <Row icon={User}     label="Name"      value={client.name} />
        <Row icon={PhoneIcon} label="Phone"     value={client.phone ? formatPhone(client.phone) : '—'} />
        <Row icon={Mail}     label="Email"     value={client.email || '—'} />
        <Row icon={Cake}     label="Birthday"  value={client.birthday || '—'} />
        <Row icon={Calendar} label="Member since" value={client.createdAt?.toDate ? client.createdAt.toDate().toLocaleDateString() : '—'} last />
        <p style={{ margin: '14px 0 0', fontSize: '0.82rem', color: T.faint }}>
          To update your details, please contact the studio.
        </p>
      </Card>

      <PackagePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={async (pkgName) => {
          await selfAssignPackage(client.id, pkgName);
        }}
      />
    </div>
  );
}

function Row({ icon: Icon, label, value, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${T.borderSoft}`,
    }}>
      <Icon size={15} color={T.faint} />
      <div style={{ fontSize: '0.78rem', color: T.muted, minWidth: 110 }}>{label}</div>
      <div style={{ fontSize: '0.92rem', color: T.text, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ── Picker prompt (shown in the "Current Package" card slot when no pkg) ──
function PackagePicker({ onPick }) {
  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <PackageIcon size={36} style={{ opacity: 0.4, color: T.faint, marginBottom: 12 }} />
      <div style={{ fontFamily: T.serif, fontSize: '1.4rem', color: T.primary, marginBottom: 6 }}>
        Pick a package to get started
      </div>
      <div style={{ fontSize: '0.9rem', color: T.muted, marginBottom: 18, maxWidth: 380, margin: '0 auto 18px' }}>
        Choose from our standard packages. Pay at the studio on your next visit.
      </div>
      <Button onClick={onPick}>See packages</Button>
    </div>
  );
}

// ── Picker modal ──────────────────────────────────────────────
function PackagePickerModal({ open, onClose, onConfirm }) {
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setSelected(null); setConfirming(false); }
  }, [open]);

  if (!open) return null;

  async function handleConfirm() {
    if (!selected) return;
    setSaving(true);
    try {
      await onConfirm(selected.name);
      toast.success(`${selected.name} selected. Pay $${selected.price} at the studio.`);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirming ? 'Confirm your package' : 'Choose your package'}
      maxWidth={640}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={saving}>Back</Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setConfirming(true)} disabled={!selected}>Continue</Button>
          </>
        )
      }
    >
      {!confirming ? (
        <>
          <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: T.muted }}>
            Pick one. All packages are valid for 30 days. Payment due at the studio on your next visit.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {CLIENT_SELECTABLE_PACKAGES.map(p => {
              const isSelected = selected?.name === p.name;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    background: isSelected ? T.primary : T.bg,
                    color:      isSelected ? T.bg : T.text,
                    border:     `1.5px solid ${isSelected ? T.primary : T.border}`,
                    borderRadius: 12, padding: '16px 14px',
                    textAlign: 'left', cursor: 'pointer',
                    fontFamily: T.sans,
                    position: 'relative',
                  }}
                >
                  {isSelected && (
                    <Check size={16} style={{ position: 'absolute', top: 12, right: 12 }} />
                  )}
                  <div style={{
                    fontFamily: T.serif, fontSize: '1.15rem',
                    fontWeight: 500, marginBottom: 4,
                  }}>{p.name}</div>
                  <div style={{
                    fontFamily: T.serif, fontSize: '1.6rem',
                    fontWeight: 500, marginBottom: 6,
                  }}>${p.price}</div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                    {p.unlimited ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <InfinityIcon size={12} /> unlimited sessions
                      </span>
                    ) : `${p.sessions} session${p.sessions === 1 ? '' : 's'}`}
                  </div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.75, marginTop: 2 }}>
                    Valid 30 days
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: '4px 0' }}>
          <div style={{
            background: T.bg, padding: '16px 18px', borderRadius: 12,
            marginBottom: 14,
          }}>
            <div style={{
              fontFamily: T.serif, fontSize: '1.5rem',
              color: T.primary, fontWeight: 500,
            }}>{selected.name}</div>
            <div style={{
              fontFamily: T.serif, fontSize: '2.2rem',
              color: T.primary, fontWeight: 500, lineHeight: 1, margin: '6px 0',
            }}>${selected.price}</div>
            <div style={{ fontSize: '0.88rem', color: T.muted }}>
              {selected.unlimited ? 'Unlimited sessions' : `${selected.sessions} session${selected.sessions === 1 ? '' : 's'}`} · Valid 30 days
            </div>
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: '#FBEFE3', color: T.warm, fontSize: '0.86rem',
          }}>
            ⚠ Once confirmed, you cannot change packages on your own. Contact the studio to switch.
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: T.bg, color: T.muted, fontSize: '0.86rem', marginTop: 10,
          }}>
            Payment is due at the studio on your next visit. You can book 1 class before your payment is verified.
          </div>
        </div>
      )}
    </Modal>
  );
}
