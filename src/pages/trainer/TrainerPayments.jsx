import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import {
  Wallet, Calendar, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, DollarSign,
} from 'lucide-react';
import {
  PageHeader, Card, Button, Badge, EmptyState, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import { formatDateLong, formatTime, todayString } from '../../utils/dates';
import { useAuth } from '../../contexts/AuthContext';
import { useTrainerPayments } from '../../hooks/useTrainerPayments';

const MIN_BOOKINGS_FOR_PAYROLL = 3;

export default function TrainerPayments() {
  const { profileId } = useAuth();
  const trainerId = profileId;

  const [month, setMonth] = useState(todayString().slice(0, 7));

  // Subscribe to ALL trainer's classes (filter to month locally)
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    if (!trainerId) { setClassesLoading(false); return; }
    const q = query(collection(db, 'classes'), where('trainerId', '==', trainerId));
    const unsub = onSnapshot(q,
      snap => { setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setClassesLoading(false); },
      err  => { console.error(err); setClassesLoading(false); }
    );
    return () => unsub();
  }, [trainerId]);

  // Subscribe to this month's payments
  const { payments, loading: paymentsLoading } = useTrainerPayments({ trainerId, month });
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // Filter classes to selected month
  const monthClasses = useMemo(
    () => classes
      .filter(c => c.date?.startsWith(month))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [classes, month],
  );

  const eligibleCount = monthClasses.filter(c =>
    (c.bookedCount || 0) >= MIN_BOOKINGS_FOR_PAYROLL && c.status !== 'cancelled'
  ).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="My Payments"
        subtitle={`Classes with at least ${MIN_BOOKINGS_FOR_PAYROLL} bookings count toward payroll.`}
      />

      {/* Month picker */}
      <Card style={{
        marginBottom: 22, padding: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <Button size="sm" variant="secondary" icon={ChevronLeft} onClick={() => setMonth(shiftMonth(month, -1))}>Prev</Button>
        <div style={{
          flex: 1, textAlign: 'center',
          fontFamily: T.serif, fontSize: '1.5rem',
          color: T.primary, fontWeight: 500,
        }}>{monthLabel(month)}</div>
        <Button size="sm" variant="secondary" icon={ChevronRight} onClick={() => setMonth(shiftMonth(month, 1))}>Next</Button>
      </Card>

      {/* Hero — total paid this month */}
      <Card style={{ marginBottom: 22, background: T.primary, color: T.bg, border: 'none' }}>
        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85, marginBottom: 6 }}>
          Total paid in {monthLabel(month)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: T.serif, fontSize: '3rem', fontWeight: 500, lineHeight: 1 }}>
            ${totalPaid}
          </span>
          <span style={{ fontSize: '0.92rem', opacity: 0.85 }}>
            from {payments.length} payment{payments.length === 1 ? '' : 's'}
          </span>
        </div>
      </Card>

      {/* Mini stats: total classes vs eligible */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 22,
      }}>
        <MiniStat label="Classes this month" value={monthClasses.length} />
        <MiniStat label="Eligible classes"   value={eligibleCount} color={T.olive} />
        <MiniStat label="Not eligible"       value={monthClasses.length - eligibleCount} color={T.muted} />
      </div>

      {/* Payments section */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
        fontWeight: 500, margin: '8px 0 12px',
      }}>Payments received</h2>

      {paymentsLoading ? (
        <Card style={{ marginBottom: 28 }}><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : payments.length === 0 ? (
        <Card style={{ marginBottom: 28 }}>
          <EmptyState
            icon={DollarSign}
            title="No payments this month"
            hint="When the studio logs a payment, it will appear here with full details."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, marginBottom: 28 }}>
          {payments.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding: '14px 16px',
                borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 12, flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{
                    fontFamily: T.serif, fontSize: '1.4rem',
                    color: T.primary, fontWeight: 500, lineHeight: 1,
                  }}>${Number(p.amount).toFixed(2)}</span>
                  <Badge bg="#EFE9DD" fg={T.muted}>{p.method}</Badge>
                </div>
                <div style={{ fontSize: '0.84rem', color: T.muted, marginTop: 4 }}>
                  {formatDateLong(p.date)}
                </div>
                {p.description && (
                  <div style={{ fontSize: '0.86rem', color: T.text, marginTop: 8, fontStyle: 'italic' }}>
                    {p.description}
                  </div>
                )}
              </div>
              <Badge bg="#EEF3E6" fg={T.olive}>
                <CheckCircle size={11} style={{ verticalAlign: 'middle' }} /> Received
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Classes section */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
        fontWeight: 500, margin: '8px 0 12px',
      }}>Classes in {monthLabel(month)}</h2>

      {classesLoading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : monthClasses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="No classes this month"
            hint="Use the month picker above to view other months."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0 }}>
          {monthClasses.map((c, i) => {
            const isEligible = (c.bookedCount || 0) >= MIN_BOOKINGS_FOR_PAYROLL && c.status !== 'cancelled';
            return (
              <div
                key={c.id}
                style={{
                  padding: '12px 16px',
                  borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 12, flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', color: T.text, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: T.faint }}>
                    {formatDateLong(c.date)} · {formatTime(c.time)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge bg="#EFE9DD" fg={T.muted}>
                    {c.bookedCount || 0} booked
                  </Badge>
                  {c.status === 'cancelled' ? (
                    <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>
                  ) : isEligible ? (
                    <Badge bg="#EEF3E6" fg={T.olive}>
                      <CheckCircle size={11} style={{ verticalAlign: 'middle' }} /> Eligible
                    </Badge>
                  ) : (
                    <Badge bg="#EFE9DD" fg={T.muted}>
                      <AlertCircle size={11} style={{ verticalAlign: 'middle' }} /> Not eligible
                    </Badge>
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

function MiniStat({ label, value, color }) {
  return (
    <Card style={{ padding: 14 }}>
      <div style={{
        fontSize: '0.72rem', textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.muted, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: T.serif, fontSize: '1.5rem',
        color: color || T.primary, fontWeight: 500, lineHeight: 1,
      }}>{value}</div>
    </Card>
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
