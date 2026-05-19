import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  Plus, Edit2, Trash2, GraduationCap, Mail, Phone as PhoneIcon, Star,
  X, DollarSign, Calendar, Users, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, Tabs, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import { useTrainers } from '../../hooks/useTrainers';
import { useTrainerPayments, logTrainerPayment } from '../../hooks/useTrainerPayments';
import { formatPhone, isValidLebanesePhone } from '../../utils/phone';
import { formatDateLong, formatTime, todayString } from '../../utils/dates';

const MIN_BOOKINGS_FOR_PAYROLL = 3;

export default function AdminTrainers() {
  const { trainers, loading, createTrainer, updateTrainer, removeTrainer } = useTrainers();
  const [editing, setEditing]   = useState(null); // null = closed, {} = new, {id, ...} = edit
  const [viewing, setViewing]   = useState(null); // trainer id to open in drawer

  async function handleDelete(t) {
    if (!confirm(`Remove trainer "${t.name}"? Their auth account will remain in Firebase (delete manually if needed) but they'll no longer appear in the app.`)) return;
    try { await removeTrainer(t.id); toast.success('Trainer removed.'); setViewing(null); }
    catch (e) { toast.error(e.message); }
  }

  const viewingTrainer = viewing ? trainers.find(t => t.id === viewing) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Trainers"
        subtitle={`${trainers.length} active`}
        right={<Button icon={Plus} onClick={() => setEditing({})}>New trainer</Button>}
      />

      {loading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : !trainers.length ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="No trainers yet"
            hint={`Click "New trainer" to create an account. They'll log in with the email + password you set.`}
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {trainers.map(t => (
            <TrainerCard
              key={t.id}
              trainer={t}
              onClick={() => setViewing(t.id)}
            />
          ))}
        </div>
      )}

      <TrainerFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        trainer={editing}
        onSave={async (data) => {
          if (editing?.id) await updateTrainer(editing.id, data);
          else             await createTrainer(data);
        }}
      />

      <TrainerDetailDrawer
        open={!!viewingTrainer}
        trainer={viewingTrainer}
        onClose={() => setViewing(null)}
        onEdit={() => { setEditing(viewingTrainer); setViewing(null); }}
        onDelete={() => handleDelete(viewingTrainer)}
      />
    </div>
  );
}

// ── Trainer card (clickable) ──────────────────────────────────
function TrainerCard({ trainer, onClick }) {
  return (
    <Card
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={trainer.name} src={trainer.avatar} />
          <div>
            <div style={{ fontFamily: T.serif, fontSize: '1.25rem', color: T.primary, fontWeight: 500, lineHeight: 1.15 }}>
              {trainer.name}
            </div>
            {trainer.speciality && (
              <div style={{ fontSize: '0.82rem', color: T.muted, marginTop: 2 }}>{trainer.speciality}</div>
            )}
          </div>
        </div>
        {trainer.avgRating > 0 && (
          <Badge bg="#FBEFE3" fg={T.warm}>
            <Star size={11} style={{ verticalAlign: 'middle' }} /> {trainer.avgRating.toFixed(1)}
          </Badge>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.84rem', color: T.muted }}>
        {trainer.email && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <Mail size={13} color={T.faint} />
            <span style={{ wordBreak: 'break-all' }}>{trainer.email}</span>
          </div>
        )}
        {trainer.phone && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <PhoneIcon size={13} color={T.faint} />
            <span>{formatPhone(trainer.phone)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function Avatar({ name, src, size = 48 }) {
  const initials = (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  if (src) {
    return (
      <img src={src} alt={name} style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        border: `1px solid ${T.border}`,
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: T.warm, color: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.serif, fontSize: size > 60 ? '1.6rem' : '1.1rem', fontWeight: 500,
    }}>{initials}</div>
  );
}

// ── Trainer detail drawer ─────────────────────────────────────
function TrainerDetailDrawer({ open, trainer, onClose, onEdit, onDelete }) {
  const [tab, setTab] = useState('overview');
  const [logOpen, setLogOpen] = useState(false);
  const [month, setMonth] = useState(todayString().slice(0, 7));

  useEffect(() => { if (open) { setTab('overview'); setMonth(todayString().slice(0, 7)); } }, [open, trainer?.id]);

  if (!open || !trainer) return null;

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
          width: '100%', maxWidth: 600, height: '100%',
          background: T.card, display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(61,35,20,0.2)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Avatar name={trainer.name} src={trainer.avatar} size={56} />
            <div>
              <h2 style={{
                margin: 0, fontFamily: T.serif, fontWeight: 500,
                color: T.primary, fontSize: '1.6rem', lineHeight: 1.1,
              }}>{trainer.name}</h2>
              {trainer.speciality && (
                <div style={{ fontSize: '0.86rem', color: T.muted, marginTop: 3 }}>{trainer.speciality}</div>
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
              { value: 'overview',  label: 'Overview' },
              { value: 'classes',   label: 'Classes' },
              { value: 'payments',  label: 'Payments' },
            ]}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {tab === 'overview' && (
            <OverviewTab trainer={trainer} onEdit={onEdit} onDelete={onDelete} />
          )}
          {tab === 'classes' && (
            <ClassesTab trainer={trainer} month={month} setMonth={setMonth} />
          )}
          {tab === 'payments' && (
            <PaymentsTab trainer={trainer} month={month} setMonth={setMonth} onLog={() => setLogOpen(true)} />
          )}
        </div>

        <LogPaymentModal
          open={logOpen}
          onClose={() => setLogOpen(false)}
          trainer={trainer}
        />
      </aside>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────
function OverviewTab({ trainer, onEdit, onDelete }) {
  return (
    <div style={{ paddingTop: 8 }}>
      <InfoRow icon={Mail}     label="Email"      value={trainer.email || '—'} />
      <InfoRow icon={PhoneIcon} label="Phone"      value={trainer.phone ? formatPhone(trainer.phone) : '—'} />
      <InfoRow icon={GraduationCap} label="Speciality" value={trainer.speciality || '—'} />
      <InfoRow icon={Star}     label="Rating"     value={trainer.avgRating > 0 ? trainer.avgRating.toFixed(1) : '—'} last />

      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" icon={Edit2}  onClick={onEdit}>Edit profile</Button>
        <Button variant="danger"    icon={Trash2} onClick={onDelete}>Remove</Button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${T.borderSoft}`,
    }}>
      <Icon size={15} color={T.faint} />
      <div style={{ fontSize: '0.78rem', color: T.muted, minWidth: 100 }}>{label}</div>
      <div style={{ fontSize: '0.92rem', color: T.text, fontWeight: 500, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

// ── Classes tab ───────────────────────────────────────────────
// Month-by-month list of their classes with eligibility badges
function ClassesTab({ trainer, month, setMonth }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trainer?.id) return;
    setLoading(true);
    const q = query(collection(db, 'classes'), where('trainerId', '==', trainer.id));
    const unsub = onSnapshot(q,
      snap => { setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error(err); setLoading(false); }
    );
    return () => unsub();
  }, [trainer?.id]);

  const monthClasses = useMemo(
    () => classes
      .filter(c => c.date?.startsWith(month))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [classes, month],
  );

  const eligible = monthClasses.filter(c =>
    (c.bookedCount || 0) >= MIN_BOOKINGS_FOR_PAYROLL && c.status !== 'cancelled'
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <MonthPicker month={month} setMonth={setMonth} />

      {/* Summary */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, marginBottom: 16,
      }}>
        <MiniStat label="Total"    value={monthClasses.length} />
        <MiniStat label="Eligible" value={eligible.length} color={T.olive} />
        <MiniStat label="Skipped"  value={monthClasses.length - eligible.length} color={T.muted} />
      </div>

      {loading ? (
        <div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div>
      ) : monthClasses.length === 0 ? (
        <EmptyState icon={Calendar} title="No classes this month" />
      ) : (
        <Card style={{ padding: 0 }}>
          {monthClasses.map((c, i) => {
            const isEligible = (c.bookedCount || 0) >= MIN_BOOKINGS_FOR_PAYROLL && c.status !== 'cancelled';
            return (
              <div
                key={c.id}
                style={{
                  padding: '12px 14px',
                  borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 10, flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', color: T.text, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: T.faint }}>
                    {formatDateLong(c.date)} · {formatTime(c.time)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge bg="#EFE9DD" fg={T.muted}>{c.bookedCount || 0} booked</Badge>
                  {c.status === 'cancelled' ? (
                    <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>
                  ) : isEligible ? (
                    <Badge bg="#EEF3E6" fg={T.olive}>Eligible</Badge>
                  ) : (
                    <Badge bg="#EFE9DD" fg={T.muted}>Not eligible</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ── Payments tab ──────────────────────────────────────────────
function PaymentsTab({ trainer, month, setMonth, onLog }) {
  const { payments, loading } = useTrainerPayments({ trainerId: trainer.id, month });
  const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <div style={{ paddingTop: 8 }}>
      <MonthPicker month={month} setMonth={setMonth} />

      {/* Total + log button */}
      <Card style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted }}>
              Total paid {monthLabel(month)}
            </div>
            <div style={{ fontFamily: T.serif, fontSize: '1.8rem', color: T.primary, fontWeight: 500, lineHeight: 1, marginTop: 4 }}>
              ${total}
            </div>
          </div>
          <Button icon={DollarSign} onClick={onLog}>Log payment</Button>
        </div>
      </Card>

      {loading ? (
        <div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div>
      ) : payments.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payments this month" hint="Click Log payment to record one." />
      ) : (
        <Card style={{ padding: 0 }}>
          {payments.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: '12px 14px',
                borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 10, flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: '0.95rem', color: T.text, fontWeight: 500 }}>
                  ${Number(p.amount).toFixed(2)} <span style={{ color: T.muted, fontWeight: 400 }}>· {p.method}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: T.faint, marginTop: 2 }}>
                  {formatDateLong(p.date)}
                </div>
                {p.description && (
                  <div style={{ fontSize: '0.82rem', color: T.muted, marginTop: 4, fontStyle: 'italic' }}>
                    {p.description}
                  </div>
                )}
              </div>
              <Badge bg="#EEF3E6" fg={T.olive}>Paid</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Log Payment modal ─────────────────────────────────────────
function LogPaymentModal({ open, onClose, trainer }) {
  const [form, setForm] = useState({
    amount: '', method: 'Cash', date: todayString(), description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ amount: '', method: 'Cash', date: todayString(), description: '' });
  }, [open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true);
    try {
      await logTrainerPayment({
        trainer,
        amount:      Number(form.amount),
        method:      form.method,
        date:        form.date,
        description: form.description,
      });
      toast.success(`Logged $${form.amount} payment to ${trainer.name}.`);
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  if (!trainer) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Log payment to ${trainer.name}`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={DollarSign} onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log payment'}</Button>
      </>}
    >
      <div style={{
        background: '#FBEFE3', padding: '10px 12px', borderRadius: 8,
        fontSize: '0.82rem', color: T.warm, marginBottom: 14,
      }}>
        This logs an expense in Finance and shows up in {trainer.name.split(' ')[0]}'s payments page.
      </div>

      <Field label="Amount (USD)" required>
        <Input
          type="number" min={0.01} step="0.01"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          placeholder="e.g. 150"
        />
      </Field>
      <Field label="Method" required>
        <Select value={form.method} onChange={e => set('method', e.target.value)}>
          <option value="Cash">Cash</option>
          <option value="Whish">Whish</option>
        </Select>
      </Field>
      <Field label="Date" required>
        <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
      </Field>
      <Field label="Note" hint="Optional. Visible to the trainer.">
        <Textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="e.g. 8 classes in March, $20 each"
        />
      </Field>
    </Modal>
  );
}

// ── Form modal (unchanged from Phase 3) ───────────────────────
function TrainerFormModal({ open, onClose, trainer, onSave }) {
  const isEdit = !!trainer?.id;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', speciality: '', avatar: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name:       trainer?.name || '',
      email:      trainer?.email || '',
      phone:      trainer?.phoneRaw || trainer?.phone || '',
      password:   '',
      speciality: trainer?.speciality || '',
      avatar:     trainer?.avatar || '',
    });
  }, [open, trainer?.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim())                                  { toast.error('Name is required.'); return; }
    if (!isEdit) {
      if (!form.email.trim())                                { toast.error('Email is required.'); return; }
      if (!form.password || form.password.length < 6)         { toast.error('Password must be at least 6 characters.'); return; }
    }
    if (form.phone && !isValidLebanesePhone(form.phone))     { toast.error('Enter a valid Lebanese phone.'); return; }

    setSaving(true);
    try {
      const payload = {
        name:       form.name.trim(),
        email:      form.email.trim(),
        phone:      form.phone,
        speciality: form.speciality.trim(),
        avatar:     form.avatar.trim(),
      };
      if (!isEdit) payload.password = form.password;
      await onSave(payload);
      toast.success(isEdit ? 'Trainer updated.' : 'Trainer created. They can log in now.');
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit trainer' : 'New trainer'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}
    >
      {!isEdit && (
        <div style={{
          background: '#FBEFE3', padding: '10px 12px', borderRadius: 8,
          fontSize: '0.82rem', color: T.warm, marginBottom: 14,
        }}>
          A login account will be created with the email and password below. The trainer can log in immediately and will see their schedule.
        </div>
      )}

      <Field label="Full name" required>
        <Input value={form.name} onChange={e => set('name', e.target.value)} />
      </Field>
      <Field label="Email" required={!isEdit} hint={isEdit ? 'Email cannot be changed after creation.' : ''}>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} disabled={isEdit} />
      </Field>
      {!isEdit && (
        <Field label="Password" required hint="At least 6 characters. Share with the trainer separately.">
          <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} />
        </Field>
      )}
      <Field label="Phone">
        <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="70 111 222" />
      </Field>
      <Field label="Speciality" hint="Shown on their trainer card.">
        <Input value={form.speciality} onChange={e => set('speciality', e.target.value)} placeholder="Reformer, Mat, Pre/Post-natal…" />
      </Field>
      <Field label="Avatar URL" hint="Optional. Leave blank to use initials.">
        <Input value={form.avatar} onChange={e => set('avatar', e.target.value)} placeholder="https://…" />
      </Field>
    </Modal>
  );
}

// ── Small helpers ─────────────────────────────────────────────
function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: T.bg, padding: '10px 12px', borderRadius: 8 }}>
      <div style={{
        fontSize: '0.7rem', textTransform: 'uppercase',
        letterSpacing: '0.06em', color: T.muted, marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: T.serif, fontSize: '1.3rem',
        color: color || T.primary, fontWeight: 500, lineHeight: 1,
      }}>{value}</div>
    </div>
  );
}

function MonthPicker({ month, setMonth }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 14, gap: 10,
    }}>
      <Button size="sm" variant="secondary" icon={ChevronLeft} onClick={() => setMonth(shiftMonth(month, -1))}>Prev</Button>
      <div style={{
        flex: 1, textAlign: 'center',
        fontFamily: T.serif, fontSize: '1.2rem',
        color: T.primary, fontWeight: 500,
      }}>{monthLabel(month)}</div>
      <Button size="sm" variant="secondary" icon={ChevronRight} onClick={() => setMonth(shiftMonth(month, 1))}>Next</Button>
    </div>
  );
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
