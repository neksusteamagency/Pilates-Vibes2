import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  PageHeader, Card, Button, Select, Badge, T,
} from '../../components/ui';
import {
  weekDates, formatDateShort, formatTime,
  TIME_SLOTS, DAY_LABELS_SHORT, addDays, todayString,
} from '../../utils/dates';
import { useClasses } from '../../hooks/useClasses';
import { useTrainers } from '../../hooks/useTrainers';
import AddClassModal from './components/AddClassModal';
import ClassDetailModal from './components/ClassDetailModal';

export default function AdminSchedule() {
  const [weekAnchor, setWeekAnchor] = useState(todayString());
  const [trainerId,  setTrainerId]  = useState('');
  const [picker,     setPicker]     = useState(null); // { date, time } — opens AddClassModal
  const [selected,   setSelected]   = useState(null); // class id — opens ClassDetailModal

  const dates     = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const startDate = dates[0];
  const endDate   = dates[6];

  const ops = useClasses({ startDate, endDate, trainerId: trainerId || undefined });
  const { trainers } = useTrainers();

  // index classes by 'YYYY-MM-DD:HH:00'
  const grid = useMemo(() => {
    const m = {};
    ops.classes.forEach(c => { m[`${c.date}:${c.time}`] = c; });
    return m;
  }, [ops.classes]);

  const selectedClass = selected ? ops.classes.find(c => c.id === selected) : null;
  const shiftWeek = (deltaDays) => setWeekAnchor(prev => addDays(prev, deltaDays));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Schedule"
        subtitle={`${formatDateShort(startDate)} — ${formatDateShort(endDate)}`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="secondary" icon={ChevronLeft}  onClick={() => shiftWeek(-7)}>Prev</Button>
            <Button variant="secondary"                     onClick={() => setWeekAnchor(todayString())}>Today</Button>
            <Button variant="secondary" icon={ChevronRight} onClick={() => shiftWeek(7)}>Next</Button>
          </div>
        }
      />

      {/* Trainer filter */}
      <Card style={{ padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.84rem', color: T.muted }}>Filter by trainer:</span>
        <Select
          value={trainerId}
          onChange={e => setTrainerId(e.target.value)}
          style={{ width: 220 }}
        >
          <option value="">All trainers</option>
          {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: '0.8rem', color: T.muted }}>
          <Legend color="#EEF3E6" border="#7C8C5E" label="Available" />
          <Legend color="#F5DDDD" border="#8C3A3A" label="Full" />
          <Legend color={T.bg}    border={T.border} label="Empty" />
        </div>
      </Card>

      {/* Desktop grid */}
      <div className="sched-desktop">
        <Card style={{ padding: 0, overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '70px repeat(7, minmax(110px, 1fr))',
            minWidth: 870,
          }}>
            {/* Header row */}
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

            {/* Time rows */}
            {TIME_SLOTS.map(time => (
              <div key={time} style={{ display: 'contents' }}>
                <div style={timeLabelCell()}>{formatTime(time)}</div>
                {dates.map(d => {
                  const c = grid[`${d}:${time}`];
                  return (
                    <ScheduleCell
                      key={d + time}
                      classRef={c}
                      onClick={() => c ? setSelected(c.id) : setPicker({ date: d, time })}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Mobile: day-by-day list */}
      <div className="sched-mobile" style={{ display: 'none' }}>
        {dates.map((d, i) => {
          const dayClasses = ops.classes
            .filter(c => c.date === d)
            .sort((a, b) => a.time.localeCompare(b.time));
          return (
            <Card key={d} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontFamily: T.serif, fontSize: '1.2rem', color: T.primary }}>
                  {DAY_LABELS_SHORT[i]} {d.slice(5)}
                </h3>
              </div>
              {dayClasses.length === 0 ? (
                <div style={{ color: T.faint, fontSize: '0.86rem' }}>No classes</div>
              ) : dayClasses.map(c => (
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
                    <div style={{ fontSize: '0.76rem', color: T.faint }}>{c.trainer}</div>
                  </div>
                  <Badge
                    bg={c.bookedCount >= c.capacity ? '#F5DDDD' : '#EEF3E6'}
                    fg={c.bookedCount >= c.capacity ? T.danger : T.olive}
                  >
                    {c.bookedCount || 0}/{c.capacity || 6}
                  </Badge>
                </div>
              ))}
            </Card>
          );
        })}
      </div>

      <AddClassModal
        open={!!picker}
        prefill={picker}
        onClose={() => setPicker(null)}
        ops={ops}
      />
      <ClassDetailModal
        open={!!selectedClass}
        classRef={selectedClass}
        onClose={() => setSelected(null)}
        ops={ops}
      />

      <style>{`
        @media (max-width: 900px) {
          .sched-desktop { display: none !important; }
          .sched-mobile  { display: block !important; }
        }
      `}</style>
    </div>
  );
}

function ScheduleCell({ classRef, onClick }) {
  const isFull = classRef && (classRef.bookedCount || 0) >= (classRef.capacity || 6);
  const isCancelled = classRef?.status === 'cancelled';

  let bg = T.card, border = T.borderSoft, textColor = T.text;
  if (classRef) {
    if (isCancelled) { bg = '#F1E8E8'; border = '#D5BBBB'; textColor = T.muted; }
    else if (isFull) { bg = '#F5DDDD'; border = '#DDB0B0'; textColor = T.danger; }
    else             { bg = '#EEF3E6'; border = '#B6C997'; textColor = '#4E6A2E'; }
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: bg, border: `1px solid ${border}`,
        margin: 2, padding: '8px 10px', minHeight: 64,
        borderRadius: 6, cursor: 'pointer',
        fontSize: '0.78rem', color: textColor,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      {classRef ? (
        <>
          <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{classRef.name}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>{classRef.trainer}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 500 }}>
            {classRef.bookedCount || 0}/{classRef.capacity || 6}{isCancelled && ' · cancelled'}
          </div>
        </>
      ) : (
        <div style={{ color: T.faint, textAlign: 'center', marginTop: 18 }}>
          <Plus size={14} />
        </div>
      )}
    </div>
  );
}

function Legend({ color, border, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        display: 'inline-block', width: 12, height: 12,
        background: color, border: `1px solid ${border}`, borderRadius: 3,
      }} />
      {label}
    </span>
  );
}

function headerCell() {
  return {
    background:   T.bg,
    padding:      '11px 8px',
    textAlign:    'center',
    borderBottom: `1px solid ${T.border}`,
  };
}

function timeLabelCell() {
  return {
    background:   T.bg,
    padding:      '8px 6px',
    textAlign:    'center',
    fontSize:     '0.74rem',
    color:        T.muted,
    borderRight:  `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
