import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Edit2, Trash2, MessageCircle, UserPlus, Check, X as XIcon, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, Modal, Field, Input, Select, Badge, Tabs, EmptyState, T,
} from '../../../components/ui';
import { db } from '../../../firebase/config';
import { formatDateLong, formatTime, todayString, isClassStarted } from '../../../utils/dates';
import { useBookings, bookClass, cancelBooking } from '../../../hooks/useBookings';
import { useAttendance, markAttendance } from '../../../hooks/useAttendance';
import { useWaitlist, approveWaitlist, rejectWaitlist } from '../../../hooks/useWaitlist';
import { useTrainers } from '../../../hooks/useTrainers';
import { useClients } from '../../../hooks/useClients';
import { buildWhatsAppLink, msgBookingConfirmation } from '../../../utils/whatsapp';

export default function ClassDetailModal({ open, onClose, classRef, ops }) {
  const [tab, setTab] = useState('details');
  useEffect(() => { if (open) setTab('details'); }, [open, classRef?.id]);

  if (!open || !classRef) return null;

  return (
    <Modal open={open} onClose={onClose} title={classRef.name} maxWidth={680}>
      {/* Header info */}
      <div style={{
        background: T.bg, padding: '12px 14px', borderRadius: 8,
        marginBottom: 14, display: 'flex', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ fontSize: '0.88rem', color: T.text }}>
          <strong>{formatDateLong(classRef.date)}</strong> · {formatTime(classRef.time)}
        </div>
        <div style={{ fontSize: '0.86rem', color: T.muted }}>
          Trainer: <strong style={{ color: T.text }}>{classRef.trainer}</strong>
        </div>
        <div style={{ fontSize: '0.86rem', color: T.muted }}>
          {classRef.bookedCount || 0} / {classRef.capacity || 6} booked
        </div>
        {classRef.status === 'cancelled' && <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>}
        {classRef.isRecurring && <Badge bg="#E3EAF3" fg="#3A5A8C">Recurring</Badge>}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'details',  label: 'Details' },
          { value: 'add',      label: 'Add booking' },
          { value: 'waitlist', label: 'Waitlist' },
        ]}
      />

      {tab === 'details'  && <DetailsTab  classRef={classRef} ops={ops} onClose={onClose} />}
      {tab === 'add'      && <AddBookingTab classRef={classRef} />}
      {tab === 'waitlist' && <WaitlistTab   classRef={classRef} />}
    </Modal>
  );
}

// ── Details tab ───────────────────────────────────────────────
function DetailsTab({ classRef, ops, onClose }) {
  const { bookings }   = useBookings({ classId: classRef.id });
  const { attendance } = useAttendance({ classId: classRef.id });
  const [editing, setEditing] = useState(false);

  // Map bookingId → attendance record
  const attMap = useMemo(() => {
    const m = {};
    attendance.forEach(a => { m[a.bookingId] = a; });
    return m;
  }, [attendance]);

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const canMark = isClassStarted(classRef.date, classRef.time);

  async function mark(b, status) {
    if (!canMark) { toast.error("Class hasn't started yet."); return; }
    try { await markAttendance({ booking: b, status }); toast.success(`Marked ${status}.`); }
    catch (e) { toast.error(e.message); }
  }

  async function cancel(b) {
    if (!confirm(`Cancel ${b.clientName}'s booking? Their session will be returned.`)) return;
    try { await cancelBooking({ bookingId: b.id }); toast.success('Booking cancelled, session returned.'); }
    catch (e) { toast.error(e.message); }
  }

  async function deleteWhole(opt) {
    const msg = opt === 'all'
      ? 'Delete THIS and ALL FUTURE instances of this recurring class?'
      : 'Delete just this class instance?';
    if (!confirm(msg)) return;

    try {
      // Cancel all active bookings (returns sessions)
      for (const b of activeBookings) {
        await cancelBooking({ bookingId: b.id, cancelledBy: 'admin-class-deleted' });
      }
      if (opt === 'all' && classRef.recurrenceId) {
        await ops.removeFutureInstances(classRef.recurrenceId, classRef.date);
        toast.success('All future instances deleted.');
      } else {
        await ops.removeClass(classRef.id);
        toast.success('Class deleted.');
      }
      onClose();
    } catch (e) { toast.error(e.message); }
  }

  if (editing) {
    return <EditClassForm classRef={classRef} ops={ops} onDone={() => setEditing(false)} />;
  }

  return (
    <div>
      <h3 style={{ fontFamily: T.serif, fontSize: '1.1rem', color: T.primary, fontWeight: 500, margin: '6px 0 10px' }}>
        Booked Clients
      </h3>

      {!canMark && (
        <div style={{
          padding: '10px 12px', background: '#FBEFE3', borderRadius: 8,
          fontSize: '0.82rem', color: T.warm, marginBottom: 12,
        }}>
          ⏰ Attendance can only be marked after the class starts.
        </div>
      )}

      {activeBookings.length === 0 ? (
        <div style={{ color: T.faint, fontSize: '0.88rem', padding: '12px 0' }}>
          No bookings yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeBookings.map(b => (
            <BookingRow
              key={b.id}
              booking={b}
              attendance={attMap[b.id]}
              onMark={mark}
              onCancel={cancel}
              classRef={classRef}
              canMark={canMark}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        marginTop: 22, paddingTop: 16, borderTop: `1px solid ${T.border}`,
        display: 'flex', gap: 10, flexWrap: 'wrap',
      }}>
        <Button variant="secondary" icon={Edit2} onClick={() => setEditing(true)}>Edit class</Button>
        {classRef.recurrenceId ? (
          <>
            <Button variant="danger" icon={Trash2} onClick={() => deleteWhole('this')}>Delete this only</Button>
            <Button variant="danger" icon={Trash2} onClick={() => deleteWhole('all')}>Delete all future</Button>
          </>
        ) : (
          <Button variant="danger" icon={Trash2} onClick={() => deleteWhole('this')}>Delete class</Button>
        )}
      </div>
    </div>
  );
}

function BookingRow({ booking, attendance, onMark, onCancel, classRef, canMark }) {
  const [client, setClient] = useState(null);
  useEffect(() => {
    getDoc(doc(db, 'clients', booking.clientId)).then(snap => {
      if (snap.exists()) setClient({ id: snap.id, ...snap.data() });
    });
  }, [booking.clientId]);

  const phone = client?.phone;
  const waConfirm = phone ? buildWhatsAppLink(phone, msgBookingConfirmation({
    clientName: booking.clientName, className: classRef.name,
    date: classRef.date, time: classRef.time, trainer: classRef.trainer,
  })) : null;

  const status = attendance?.status;

  return (
    <div style={{
      padding: '11px 13px', background: T.bg, borderRadius: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 10, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontWeight: 500, fontSize: '0.92rem', color: T.text }}>{booking.clientName}</div>
        <div style={{ fontSize: '0.78rem', color: T.faint }}>
          {client ? `${client.pkgUnlimited ? '∞' : client.pkgSessions} sess remaining` : '…'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {status === 'attended' && <Badge bg="#EEF3E6" fg={T.olive}>Attended</Badge>}
        {status === 'no-show'  && <Badge bg="#F5DDDD" fg={T.danger}>No-show</Badge>}
        <Button size="sm" variant={status === 'attended' ? 'olive' : 'secondary'} onClick={() => onMark(booking, 'attended')} disabled={!canMark}>
          Attended
        </Button>
        <Button size="sm" variant={status === 'no-show' ? 'danger' : 'secondary'} onClick={() => onMark(booking, 'no-show')} disabled={!canMark}>
          No-show
        </Button>
        {waConfirm && (
          <Button size="sm" variant="ghost" icon={MessageCircle} onClick={() => window.open(waConfirm, '_blank')}>
            WA
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => onCancel(booking)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Edit class form ───────────────────────────────────────────
function EditClassForm({ classRef, ops, onDone }) {
  const { trainers } = useTrainers();
  const [form, setForm] = useState({
    name:      classRef.name || '',
    time:      classRef.time || '',
    trainerId: classRef.trainerId || '',
    capacity:  classRef.capacity || 6,
  });
  const [scope, setScope] = useState('this'); // 'this' | 'all'
  const [saving, setSaving] = useState(false);
  const trainer = trainers.find(t => t.id === form.trainerId);

  async function save() {
    setSaving(true);
    try {
      const changes = {
        name:      form.name,
        time:      form.time,
        trainer:   trainer?.name || classRef.trainer,
        trainerId: form.trainerId,
        capacity:  Number(form.capacity) || 6,
      };
      await ops.updateClass(classRef.id, changes);
      if (scope === 'all' && classRef.recurrenceId) {
        await ops.updateFutureInstances(classRef.recurrenceId, classRef.date, changes);
        toast.success('All future instances updated.');
      } else {
        toast.success('Class updated.');
      }
      onDone();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <Field label="Class name">
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Time">
        <Input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
      </Field>
      <Field label="Trainer">
        <Select value={form.trainerId} onChange={e => setForm(p => ({ ...p, trainerId: e.target.value }))}>
          {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <Field label="Capacity">
        <Input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))} />
      </Field>
      {classRef.recurrenceId && (
        <Field label="Apply to">
          <Select value={scope} onChange={e => setScope(e.target.value)}>
            <option value="this">This instance only</option>
            <option value="all">This and all future instances</option>
          </Select>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Add booking tab ───────────────────────────────────────────
function AddBookingTab({ classRef }) {
  const { clients }  = useClients();
  const { bookings } = useBookings({ classId: classRef.id });
  const [search, setSearch] = useState('');
  const [busy,   setBusy]   = useState(false);

  const today = todayString();
  const activeBookedIds = new Set(bookings.filter(b => b.status !== 'cancelled').map(b => b.clientId));
  const spotsLeft = (classRef.capacity || 6) - (classRef.bookedCount || 0);

  const eligible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return clients.filter(c => {
      if (activeBookedIds.has(c.id))                          return false;
      if (!c.pkg)                                              return false;
      if (c.isFrozen)                                          return false;
      if (c.pkgExpiry && c.pkgExpiry < today)                  return false;
      if (!c.pkgUnlimited && (c.pkgSessions ?? 0) <= 0)         return false;
      if (s && !`${c.name || ''} ${c.phone || ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [clients, activeBookedIds, search, today]);

  async function book(client) {
    if (spotsLeft <= 0) { toast.error('Class is full.'); return; }
    setBusy(true);
    try {
      await bookClass({ classId: classRef.id, client });
      toast.success(`${client.name} booked.`);
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ fontSize: '0.86rem', color: T.muted, marginBottom: 12 }}>
        {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left.` : 'Class is full.'}
        {' '}Only clients with an active package are shown.
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: T.faint }} />
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {eligible.length === 0 ? (
        <EmptyState icon={UserPlus} title="No eligible clients" hint="They need an unfrozen, unexpired package with sessions remaining." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {eligible.map(c => (
            <div key={c.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: T.bg, borderRadius: 8,
            }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: T.text }}>{c.name}</div>
                <div style={{ fontSize: '0.76rem', color: T.faint }}>
                  {c.pkg} • {c.pkgUnlimited ? '∞' : `${c.pkgSessions} left`}
                </div>
              </div>
              <Button size="sm" icon={Check} onClick={() => book(c)} disabled={busy || spotsLeft <= 0}>Book</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Waitlist tab ──────────────────────────────────────────────
function WaitlistTab({ classRef }) {
  const { waitlist, loading } = useWaitlist({ classId: classRef.id });

  async function approve(id) {
    if (!confirm('Approve this waitlist entry? A session will be deducted.')) return;
    try { await approveWaitlist(id); toast.success('Approved, booking created.'); }
    catch (e) { toast.error(e.message); }
  }
  async function reject(id) {
    try { await rejectWaitlist(id); toast.success('Rejected.'); }
    catch (e) { toast.error(e.message); }
  }

  if (loading)          return <div style={{ color: T.faint, padding: 20 }}>Loading…</div>;
  if (!waitlist.length) return <EmptyState icon={UserPlus} title="No waitlist entries" hint="When the class is full, clients can join the waitlist from their dashboard." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {waitlist.map(w => (
        <div key={w.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', background: T.bg, borderRadius: 8,
        }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 500, color: T.text }}>{w.clientName}</div>
            <div style={{ fontSize: '0.76rem', color: T.faint }}>
              Joined {w.joinedAt?.toDate ? w.joinedAt.toDate().toLocaleString() : '…'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" variant="olive"  icon={Check}  onClick={() => approve(w.id)}>Approve</Button>
            <Button size="sm" variant="danger" icon={XIcon} onClick={() => reject(w.id)}>Reject</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
