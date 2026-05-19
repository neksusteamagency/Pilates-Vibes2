import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, ClipboardCheck, AlertCircle, TrendingDown,
} from 'lucide-react';
import {
  PageHeader, Card, Button, Badge, EmptyState, T,
} from '../../components/ui';
import {
  weekDates, formatDateLong, formatDateShort, formatTime,
  todayString, addDays, DAY_LABELS_LONG, isClassStarted,
} from '../../utils/dates';
import { useClasses } from '../../hooks/useClasses';
import { useAttendance } from '../../hooks/useAttendance';
import { useClients } from '../../hooks/useClients';
import ClassDetailModal from './components/ClassDetailModal';

export default function AdminAttendance() {
  const today = todayString();
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [activeDay,  setActiveDay]  = useState(today);
  const [selected,   setSelected]   = useState(null);

  const dates = useMemo(() => weekDates(weekAnchor), [weekAnchor]);

  // Fetch this week's classes and attendance
  const ops            = useClasses({ startDate: dates[0], endDate: dates[6] });
  const { attendance } = useAttendance({ startDate: dates[0], endDate: dates[6] });
  const { clients }    = useClients();

  // Today's metrics
  const todayClasses    = ops.classes.filter(c => c.date === today);
  const todayBookings   = todayClasses.reduce((s, c) => s + (c.bookedCount || 0), 0);
  const todayAttendance = attendance.filter(a => a.date === today);
  const todayAttended   = todayAttendance.filter(a => a.status === 'attended').length;
  const todayNoShows    = todayAttendance.filter(a => a.status === 'no-show').length;
  const todayNoShowList = todayAttendance.filter(a => a.status === 'no-show');

  // Low-sessions clients (≤2 sessions, package + not expired/frozen)
  const lowSessions = clients.filter(c =>
    c.pkg && !c.isFrozen && !c.pkgUnlimited &&
    (c.pkgSessions ?? 99) <= 2 && (c.pkgSessions ?? 0) > 0 &&
    (!c.pkgExpiry || c.pkgExpiry >= today)
  );

  // Selected day's classes
  const dayClasses = ops.classes
    .filter(c => c.date === activeDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Aggregate attendance per class
  const attendanceByClass = useMemo(() => {
    const m = {};
    attendance.forEach(a => {
      if (!m[a.classId]) m[a.classId] = { attended: 0, noShow: 0 };
      if (a.status === 'attended') m[a.classId].attended += 1;
      if (a.status === 'no-show')  m[a.classId].noShow   += 1;
    });
    return m;
  }, [attendance]);

  const selectedClass = selected ? ops.classes.find(c => c.id === selected) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Attendance"
        subtitle={`Week of ${formatDateShort(dates[0])}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={ChevronLeft} onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>Prev</Button>
            <Button variant="secondary" onClick={() => { setWeekAnchor(today); setActiveDay(today); }}>Today</Button>
            <Button variant="secondary" icon={ChevronRight} onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>Next</Button>
          </div>
        }
      />

      {/* Today's metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 22 }}>
        <Metric label="Today's classes"  value={todayClasses.length} color={T.primary} />
        <Metric label="Today's bookings" value={todayBookings}       color={T.warm} />
        <Metric label="Attended"         value={todayAttended}       color={T.olive} />
        <Metric label="No-shows"         value={todayNoShows}        color={T.danger} />
      </div>

      {/* Day picker */}
      <Card style={{ padding: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
          {dates.map((d, i) => {
            const active  = d === activeDay;
            const isToday = d === today;
            const count   = ops.classes.filter(c => c.date === d).length;
            return (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                style={{
                  flex: 1, minWidth: 90,
                  background: active ? T.primary : 'transparent',
                  color:      active ? T.bg : (isToday ? T.primary : T.muted),
                  border:     `1px solid ${active ? T.primary : T.border}`,
                  borderRadius: 8, padding: '10px 8px',
                  cursor: 'pointer', textAlign: 'center',
                  fontFamily: T.sans,
                }}
              >
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>
                  {DAY_LABELS_LONG[i].slice(0, 3)}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 500, margin: '3px 0' }}>{d.slice(8)}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                  {count} {count === 1 ? 'class' : 'classes'}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected day's classes */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
        fontWeight: 500, margin: '8px 0 12px',
      }}>{formatDateLong(activeDay)}</h2>

      {dayClasses.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No classes on this day"
            hint="Pick another day, or schedule a class first."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dayClasses.map(c => {
            const att     = attendanceByClass[c.id] || { attended: 0, noShow: 0 };
            const total   = c.bookedCount || 0;
            const pending = total - att.attended - att.noShow;
            const started = isClassStarted(c.date, c.time);

            return (
              <Card
                key={c.id}
                style={{
                  cursor: 'pointer',
                  borderColor: started ? T.olive : T.border,
                  padding: 16,
                }}
                onClick={() => setSelected(c.id)}
              >
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  gap: 14, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <span style={{ fontFamily: T.serif, fontSize: '1.2rem', color: T.primary, fontWeight: 500 }}>
                        {c.name}
                      </span>
                      <span style={{ fontSize: '0.86rem', color: T.muted }}>{formatTime(c.time)}</span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: T.faint }}>{c.trainer}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge bg="#EFE9DD" fg={T.muted}>{total} booked</Badge>
                    <Badge bg="#EEF3E6" fg={T.olive}>{att.attended} attended</Badge>
                    <Badge bg="#F5DDDD" fg={T.danger}>{att.noShow} no-show</Badge>
                    {pending > 0 && started && <Badge bg="#FBEFE3" fg={T.warm}>{pending} pending</Badge>}
                    {!started && <Badge bg="#E3EAF3" fg="#3A5A8C">Not yet started</Badge>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Today's no-shows */}
      {todayNoShowList.length > 0 && (
        <>
          <h2 style={{
            fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
            fontWeight: 500, margin: '28px 0 12px',
          }}>Today's No-Shows</h2>
          <Card>
            {todayNoShowList.map(n => (
              <div key={n.id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid ${T.borderSoft}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertCircle size={15} color={T.danger} />
                  <span style={{ fontSize: '0.92rem', color: T.text }}>{n.clientName}</span>
                </div>
                <span style={{ fontSize: '0.82rem', color: T.faint }}>
                  Class {n.classId.slice(0, 6)}…
                </span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Low-sessions clients */}
      {lowSessions.length > 0 && (
        <>
          <h2 style={{
            fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
            fontWeight: 500, margin: '28px 0 12px',
          }}>Low Sessions ({lowSessions.length})</h2>
          <Card>
            <p style={{ margin: '0 0 12px', color: T.faint, fontSize: '0.86rem' }}>
              Clients with 2 or fewer sessions remaining. Reach out to renew.
            </p>
            {lowSessions.map(c => (
              <div key={c.id} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid ${T.borderSoft}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TrendingDown size={15} color={T.warm} />
                  <span style={{ fontSize: '0.92rem', color: T.text }}>{c.name}</span>
                  <span style={{ fontSize: '0.78rem', color: T.faint }}>{c.pkg}</span>
                </div>
                <Badge bg="#FBEFE3" fg={T.warm}>{c.pkgSessions} left</Badge>
              </div>
            ))}
          </Card>
        </>
      )}

      <ClassDetailModal
        open={!!selectedClass}
        classRef={selectedClass}
        onClose={() => setSelected(null)}
        ops={ops}
      />
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
      <div style={{
        fontFamily: T.serif, fontSize: '2rem', color,
        fontWeight: 500, lineHeight: 1,
      }}>{value}</div>
    </Card>
  );
}
