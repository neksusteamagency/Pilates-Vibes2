import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  ChevronLeft, ChevronRight, Calendar, Check, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Badge, Modal, EmptyState, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import {
  weekDates, formatDateShort, formatDateLong, formatTime,
  todayString, addDays, DAY_LABELS_SHORT, isWithin12Hours,
} from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useBookings, clientSelfBookClass } from '../../hooks/useBookings';
import { joinWaitlist } from '../../hooks/useWaitlist';
import { checkBookingEligibility } from '../../utils/bookingRules';

const BOOKING_WINDOW_DAYS = 14;

export default function ClientBook() {
  const { currentUser } = useAuth();
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'clients'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      setClient(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const today = todayString();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [confirmFor, setConfirmFor] = useState(null);

  const maxYMD = useMemo(() => addDays(today, BOOKING_WINDOW_DAYS), [today]);
  const dates = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const queryStart = dates[0] < today  ? today  : dates[0];
  const queryEnd   = dates[6] > maxYMD ? maxYMD : dates[6];

  const { classes, loading } = useClasses({ startDate: queryStart, endDate: queryEnd });

  const { bookings: myBookings } = useBookings({ clientId: client?.id });
  const myBookedClassIds = useMemo(() =>
    new Set(myBookings.filter(b => b.status !== 'cancelled').map(b => b.classId)),
  [myBookings]);

  const byDay = useMemo(() => {
    const m = {};
    dates.forEach(d => { m[d] = []; });
    classes.forEach(c => {
      if (!m[c.date]) return;
      m[c.date].push(c);
    });
    Object.values(m).forEach(list => list.sort((a, b) => a.time.localeCompare(b.time)));
    return m;
  }, [classes, dates]);

  const isPrevDisabled = dates[6] <= today;
  const isNextDisabled = dates[0] >= maxYMD;
  const shiftWeek = (deltaDays) => setWeekAnchor(prev => addDays(prev, deltaDays));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader
        title="Book a Class"
        subtitle={`Showing ${formatDateShort(dates[0])} — ${formatDateShort(dates[6])}. Bookings open ${BOOKING_WINDOW_DAYS} days ahead.`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={ChevronLeft}  onClick={() => shiftWeek(-7)} disabled={isPrevDisabled}>Prev</Button>
            <Button variant="secondary" onClick={() => setWeekAnchor(today)}>Today</Button>
            <Button variant="secondary" icon={ChevronRight} onClick={() => shiftWeek(7)} disabled={isNextDisabled}>Next</Button>
          </div>
        }
      />

      {client && !client.pkg && (
        <Card style={{ marginBottom: 22, background: '#FBEFE3', borderColor: '#E5C9A8' }}>
          <div style={{ color: T.warm, fontSize: '0.9rem' }}>
            ⚠ You don't have an active package. Pick one from your profile to start booking.
          </div>
        </Card>
      )}
      {client?.isFrozen && (
        <Card style={{ marginBottom: 22, background: '#E3EAF3', borderColor: '#B8C7DB' }}>
          <div style={{ color: '#3A5A8C', fontSize: '0.9rem' }}>
            ❄ Your package is frozen. Resume it from the studio to book again.
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="No classes this week"
            hint="Check next week or contact the studio if you think this is a mistake."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {dates.map((d, i) => {
            const dayClasses = byDay[d] || [];
            const isPast = d < today;
            const isOutOfWindow = d > maxYMD;
            if (isPast || isOutOfWindow) return null;
            return (
              <DayBlock
                key={d}
                date={d}
                classes={dayClasses}
                client={client}
                myBookedClassIds={myBookedClassIds}
                onPickClass={setConfirmFor}
              />
            );
          })}
        </div>
      )}

      <ConfirmBookingModal
        open={!!confirmFor}
        onClose={() => setConfirmFor(null)}
        classRef={confirmFor}
        client={client}
      />
    </div>
  );
}

function DayBlock({ date, classes, client, myBookedClassIds, onPickClass }) {
  const today = todayString();
  if (classes.length === 0 && date !== today) return null;

  const heading = date === today ? 'Today' : formatDateLong(date);

  return (
    <Card>
      <h3 style={{
        margin: '0 0 12px', fontFamily: T.serif, fontSize: '1.3rem',
        color: T.primary, fontWeight: 500,
      }}>
        {heading}
      </h3>

      {classes.length === 0 ? (
        <div style={{ color: T.faint, fontSize: '0.86rem' }}>No classes scheduled.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {classes.map(c => {
            const isBooked = myBookedClassIds.has(c.id);
            const eligibility = client
              ? checkBookingEligibility({ client, classRef: c, isClientSelf: true })
              : { ok: false, reason: 'Loading…' };
            const isFull = (c.bookedCount || 0) >= (c.capacity || 6);
            return (
              <ClassRow
                key={c.id}
                classRef={c}
                isBooked={isBooked}
                isFull={isFull}
                eligibility={eligibility}
                onPick={() => onPickClass(c)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ClassRow({ classRef, isBooked, isFull, eligibility, onPick }) {
  let action;
  if (isBooked) {
    action = <Badge bg="#EEF3E6" fg={T.olive}><Check size={11} style={{ verticalAlign: 'middle' }} /> Booked</Badge>;
  } else if (classRef.status === 'cancelled') {
    action = <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>;
  } else if (isFull) {
    action = <Button size="sm" variant="warm" onClick={onPick}>Join waitlist</Button>;
  } else if (!eligibility.ok) {
    action = (
      <span title={eligibility.reason} style={{ fontSize: '0.78rem', color: T.faint, fontStyle: 'italic' }}>
        Unavailable
      </span>
    );
  } else {
    action = <Button size="sm" onClick={onPick}>Book</Button>;
  }

  return (
    <div style={{
      padding: '11px 13px', background: T.bg, borderRadius: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 10, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: '0.96rem', fontWeight: 500, color: T.text }}>
          {classRef.name} <span style={{ color: T.muted, fontWeight: 400 }}>· {formatTime(classRef.time)}</span>
        </div>
        <div style={{ fontSize: '0.78rem', color: T.faint, marginTop: 2 }}>
          {/* No booking count — just availability status */}
          {classRef.status === 'cancelled'
            ? <span style={{ color: T.danger }}>Cancelled</span>
            : isFull
              ? <span style={{ color: T.danger }}>Full</span>
              : <span style={{ color: T.olive }}>Available</span>}
          {' · '}<span style={{ color: T.muted }}>{classRef.trainer}</span>
        </div>
      </div>
      {action}
    </div>
  );
}

function ConfirmBookingModal({ open, onClose, classRef, client }) {
  const [busy, setBusy] = useState(false);
  if (!open || !classRef) return null;

  const isFull = (classRef.bookedCount || 0) >= (classRef.capacity || 6);
  const within12 = isWithin12Hours(classRef.date, classRef.time);

  async function confirmBook() {
    setBusy(true);
    try {
      await clientSelfBookClass({ classId: classRef.id, client });
      toast.success('Booking confirmed!');
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function confirmWaitlist() {
    setBusy(true);
    try {
      await joinWaitlist({ classRef, client });
      toast.success("You're on the waitlist. We'll notify you if a spot opens.");
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isFull ? 'Join waitlist?' : 'Confirm booking?'}
      maxWidth={460}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {isFull
          ? <Button variant="warm" onClick={confirmWaitlist} disabled={busy}>{busy ? 'Joining…' : 'Join waitlist'}</Button>
          : <Button onClick={confirmBook} disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'}</Button>
        }
      </>}
    >
      <div style={{
        background: T.bg, padding: '14px 16px', borderRadius: 10,
        marginBottom: 14,
      }}>
        <div style={{ fontFamily: T.serif, fontSize: '1.3rem', color: T.primary, fontWeight: 500 }}>
          {classRef.name}
        </div>
        <div style={{ fontSize: '0.9rem', color: T.text, marginTop: 4 }}>
          {formatDateLong(classRef.date)} at <strong>{formatTime(classRef.time)}</strong>
        </div>
        <div style={{ fontSize: '0.84rem', color: T.muted, marginTop: 2 }}>
          with {classRef.trainer}
        </div>
      </div>

      {!isFull && client?.pkg && !client.pkgUnlimited && (
        <p style={{ margin: '0 0 10px', fontSize: '0.86rem', color: T.muted }}>
          This will use <strong>1 session</strong>. After booking: {Math.max(0, (client.pkgSessions || 0) - 1)} session(s) remaining.
        </p>
      )}

      {!isFull && within12 && (
        <p style={{
          margin: 0, padding: '10px 12px', borderRadius: 8,
          background: '#FBEFE3', color: T.warm, fontSize: '0.84rem',
        }}>
          <Clock size={13} style={{ verticalAlign: 'middle' }} /> Less than 12 hours before this class — you won't be able to cancel.
        </p>
      )}

      {isFull && (
        <p style={{ margin: 0, fontSize: '0.86rem', color: T.muted }}>
          This class is full. By joining the waitlist, you'll be notified if a spot opens up. No session is deducted until the studio approves your spot.
        </p>
      )}
    </Modal>
  );
}
