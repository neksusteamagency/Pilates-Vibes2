import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Calendar, Check, X as XIcon, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Badge, Tabs, EmptyState, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useBookings, clientSelfCancelBooking } from '../../hooks/useBookings';
import {
  formatDateLong, formatTime, todayString, isWithin12Hours,
} from '../../utils/dates';

export default function ClientHistory() {
  const { currentUser } = useAuth();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(collection(db, 'clients'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, snap => {
      setClient(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    return () => unsub();
  }, [currentUser?.uid]);

  const { bookings, loading } = useBookings({ clientId: client?.id });

  const today = todayString();

  // Sort into upcoming + past
  const { upcoming, past } = useMemo(() => {
    const up = [], pa = [];
    bookings.forEach(b => {
      const isFuture = b.date > today || (b.date === today && b.status !== 'cancelled');
      if (b.status === 'cancelled') pa.push(b);
      else if (isFuture)            up.push(b);
      else                          pa.push(b);
    });
    up.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    pa.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return { upcoming: up, past: pa };
  }, [bookings, today]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <PageHeader
        title="History"
        subtitle={`${upcoming.length} upcoming · ${past.length} past`}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { value: 'past',     label: `Past (${past.length})` },
        ]}
      />

      {loading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : tab === 'upcoming' ? (
        upcoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={Calendar}
              title="No upcoming bookings"
              hint="Head to Book Class to reserve your next spot."
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(b => <BookingRow key={b.id} booking={b} upcoming />)}
          </div>
        )
      ) : (
        past.length === 0 ? (
          <Card>
            <EmptyState
              icon={Calendar}
              title="No past bookings"
              hint="Your class history will appear here."
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map(b => <BookingRow key={b.id} booking={b} />)}
          </div>
        )
      )}
    </div>
  );
}

function BookingRow({ booking, upcoming }) {
  const [cancelling, setCancelling] = useState(false);
  const within12 = upcoming && isWithin12Hours(booking.date, booking.time);

  async function handleCancel() {
    if (within12) {
      toast.error('Cannot cancel within 12 hours of class. Contact the studio.');
      return;
    }
    if (!confirm(`Cancel your booking for ${booking.date} at ${booking.time}?`)) return;
    setCancelling(true);
    try {
      await clientSelfCancelBooking({ booking });
      toast.success('Booking cancelled. Session returned to your package.');
    } catch (e) { toast.error(e.message); }
    finally { setCancelling(false); }
  }

  let statusBadge;
  if (booking.status === 'cancelled')      statusBadge = <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>;
  else if (upcoming)                       statusBadge = <Badge bg="#EEF3E6" fg={T.olive}>Confirmed</Badge>;
  else                                     statusBadge = <Badge bg="#EFE9DD" fg={T.muted}>Completed</Badge>;

  return (
    <Card style={{
      padding: 16,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: '0.95rem', color: T.text, fontWeight: 500 }}>
          {formatDateLong(booking.date)}
        </div>
        <div style={{ fontSize: '0.85rem', color: T.muted, marginTop: 2 }}>
          {formatTime(booking.time)}
        </div>
        {within12 && upcoming && booking.status !== 'cancelled' && (
          <div style={{
            marginTop: 8, padding: '6px 10px', borderRadius: 6,
            background: '#FBEFE3', color: T.warm, fontSize: '0.78rem',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <Clock size={11} /> Less than 12 hours — cancellation locked
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {statusBadge}
        {upcoming && booking.status !== 'cancelled' && !within12 && (
          <Button size="sm" variant="danger" icon={XIcon} onClick={handleCancel} disabled={cancelling}>
            {cancelling ? '…' : 'Cancel'}
          </Button>
        )}
      </div>
    </Card>
  );
}
