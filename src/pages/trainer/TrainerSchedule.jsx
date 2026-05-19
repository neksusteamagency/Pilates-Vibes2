import { useState, useMemo, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Badge, Modal, EmptyState, T,
} from '../../components/ui';
import { db } from '../../firebase/config';
import {
  weekDates, formatDateShort, formatDateLong, formatTime,
  TIME_SLOTS, DAY_LABELS_SHORT, addDays, todayString, isClassStarted,
} from '../../utils/dates';
import { useClasses } from '../../hooks/useClasses';
import { useBookings } from '../../hooks/useBookings';
import { useAttendance, markAttendance } from '../../hooks/useAttendance';
import { useAuth } from '../../contexts/AuthContext';

export default function TrainerSchedule() {
  const { profileId } = useAuth();
  const trainerId = profileId;

  const [weekAnchor, setWeekAnchor] = useState(todayString());
  const [selected,   setSelected]   = useState(null); // class id

  const dates     = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const startDate = dates[0];
  const endDate   = dates[6];

  // Filter to this trainer's classes only
  const { classes, loading } = useClasses({ startDate, endDate, trainerId });

  // Index by date:time
  const grid = useMemo(() => {
    const m = {};
    classes.forEach(c => { m[`${c.date}:${c.time}`] = c; });
    return m;
  }, [classes]);

  const selectedClass = selected ? classes.find(c => c.id === selected) : null;
  const shiftWeek = (deltaDays) => setWeekAnchor(prev => addDays(prev, deltaDays));

  const totalClasses  = classes.length;
  const totalBookings = classes.reduce((s, c) => s + (c.bookedCount || 0), 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="My Schedule"
        subtitle={`${formatDateShort(startDate)} — ${formatDateShort(endDate)}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={ChevronLeft}  onClick={() => shiftWeek(-7)}>Prev</Button>
            <Button variant="secondary"                     onClick={() => setWeekAnchor(todayString())}>Today</Button>
            <Button variant="secondary" icon={ChevronRight} onClick={() => shiftWeek(7)}>Next</Button>
          </div>
        }
      />

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 22,
      }}>
        <Metric label="Classes this week" value={totalClasses}  color={T.primary} />
        <Metric label="Total bookings"    value={totalBookings} color={T.olive} />
      </div>

      {loading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : classes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No classes this week"
            hint="Check next or previous week with the navigation buttons."
          />
        </Card>
      ) : (
        <>
          <div className="trsched-desktop">
            <Card style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '70px repeat(7, minmax(110px, 1fr))',
                minWidth: 870,
              }}>
                <div style={headerCell()} />
                {dates.map((d, i) => {
                  const isToday = d === todayString();
                  return (
                    <div key={d} style={{
                      ...headerCell(),
                      background: isToday ? T.primary : T.bg,
                      color:      isToday ? T.bg : T.muted,
                    }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {DAY_LABELS_SHORT[i]}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>{d.slice(8)}</div>
                    </div>
                  );
                })}

                {TIME_SLOTS.map(time => (
                  <div key={time} style={{ display: 'contents' }}>
                    <div style={timeLabelCell()}>{formatTime(time)}</div>
                    {dates.map(d => {
                      const c = grid[`${d}:${time}`];
                      return c ? (
                        <Cell key={d + time} classRef={c} onClick={() => setSelected(c.id)} />
                      ) : (
                        <div key={d + time} style={emptyCell()} />
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="trsched-mobile" style={{ display: 'none' }}>
            {dates.map((d, i) => {
              const dayClasses = classes.filter(c => c.date === d).sort((a, b) => a.time.localeCompare(b.time));
              if (dayClasses.length === 0) return null;
              return (
                <Card key={d} style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: '0 0 10px', fontFamily: T.serif, fontSize: '1.2rem', color: T.primary }}>
                    {DAY_LABELS_SHORT[i]} {d.slice(5)}
                  </h3>
                  {dayClasses.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      style={{
                        padding: '10px 12px', background: T.bg, borderRadius: 8,
                        marginBottom: 6, cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: T.text }}>
                          {formatTime(c.time)} — {c.name}
                        </div>
                      </div>
                      <Badge bg={c.bookedCount >= c.capacity ? '#F5DDDD' : '#EEF3E6'} fg={c.bookedCount >= c.capacity ? T.danger : T.olive}>
                        {c.bookedCount || 0}/{c.capacity || 6}
                      </Badge>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <TrainerClassModal
        open={!!selectedClass}
        classRef={selectedClass}
        onClose={() => setSelected(null)}
      />

      <style>{`
        @media (max-width: 900px) {
          .trsched-desktop { display: none !important; }
          .trsched-mobile  { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function Cell({ classRef, onClick }) {
  const isFull = (classRef.bookedCount || 0) >= (classRef.capacity || 6);
  const isCancelled = classRef.status === 'cancelled';

  let bg = '#EEF3E6', border = '#B6C997', textColor = '#4E6A2E';
  if (isCancelled)  { bg = '#F1E8E8'; border = '#D5BBBB'; textColor = T.muted; }
  else if (isFull)  { bg = '#F5DDDD'; border = '#DDB0B0'; textColor = T.danger; }

  return (
    <div
      onClick={onClick}
      style={{
        background: bg, border: `1px solid ${border}`,
        margin: 2, padding: '8px 10px', minHeight: 64,
        borderRadius: 6, cursor: 'pointer',
        fontSize: '0.78rem', color: textColor,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{classRef.name}</div>
      <div style={{ fontSize: '0.7rem', fontWeight: 500 }}>
        {classRef.bookedCount || 0}/{classRef.capacity || 6}
        {isCancelled && ' · cancelled'}
      </div>
    </div>
  );
}

function TrainerClassModal({ open, onClose, classRef }) {
  const { bookings }   = useBookings({ classId: classRef?.id });
  const { attendance } = useAttendance({ classId: classRef?.id });

  if (!open || !classRef) return null;

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  const attMap = {};
  attendance.forEach(a => { attMap[a.bookingId] = a; });
  const canMark = isClassStarted(classRef.date, classRef.time);

  async function mark(b, status) {
    if (!canMark) { toast.error("Class hasn't started yet."); return; }
    try { await markAttendance({ booking: b, status, markedBy: 'trainer' }); toast.success(`Marked ${status}.`); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <Modal open={open} onClose={onClose} title={classRef.name} maxWidth={620}>
      <div style={{
        background: T.bg, padding: '12px 14px', borderRadius: 8,
        marginBottom: 14, fontSize: '0.88rem', color: T.text,
      }}>
        <strong>{formatDateLong(classRef.date)}</strong> · {formatTime(classRef.time)}
        <span style={{ marginLeft: 12, color: T.muted }}>
          {classRef.bookedCount || 0} / {classRef.capacity || 6} booked
        </span>
      </div>

      <h3 style={{ fontFamily: T.serif, fontSize: '1.1rem', color: T.primary, fontWeight: 500, margin: '6px 0 10px' }}>
        Roster
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
            <BookingItem
              key={b.id}
              booking={b}
              attendance={attMap[b.id]}
              onMark={mark}
              canMark={canMark}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function BookingItem({ booking, attendance, onMark, canMark }) {
  const [client, setClient] = useState(null);
  useEffect(() => {
    getDoc(doc(db, 'clients', booking.clientId)).then(snap => {
      if (snap.exists()) setClient({ id: snap.id, ...snap.data() });
    });
  }, [booking.clientId]);

  const status = attendance?.status;

  return (
    <div style={{
      padding: '11px 13px', background: T.bg, borderRadius: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 10, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontWeight: 500, fontSize: '0.92rem', color: T.text }}>{booking.clientName}</div>
        {client?.notes && (
          <div style={{ fontSize: '0.76rem', color: T.faint, fontStyle: 'italic' }}>
            Note: {client.notes}
          </div>
        )}
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
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{
        fontSize: '0.74rem', textTransform: 'uppercase',
        letterSpacing: '0.08em', color: T.muted, marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontFamily: T.serif, fontSize: '2rem', color, fontWeight: 500, lineHeight: 1 }}>
        {value}
      </div>
    </Card>
  );
}

function headerCell() {
  return {
    background: T.bg, padding: '11px 8px', textAlign: 'center',
    borderBottom: `1px solid ${T.border}`,
  };
}
function timeLabelCell() {
  return {
    background: T.bg, padding: '8px 6px', textAlign: 'center',
    fontSize: '0.74rem', color: T.muted,
    borderRight: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
function emptyCell() {
  return {
    background: T.card, border: `1px solid ${T.borderSoft}`,
    margin: 2, minHeight: 64, borderRadius: 6,
  };
}
