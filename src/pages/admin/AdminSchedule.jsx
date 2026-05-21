import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, PlusCircle } from 'lucide-react';
import {
  PageHeader, Card, Button, Select, Badge, T,
} from '../../components/ui';
import {
  weekDates, formatDateShort, formatTime,
  TIME_SLOTS, DAY_LABELS_SHORT, addDays, todayString,
  addMinutes, CLASS_DURATION_MINUTES,
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
  const [mobilePicker,  setMobilePicker]  = useState(null); // date string — opens time picker on mobile

  const dates     = useMemo(() => weekDates(weekAnchor), [weekAnchor]);
  const startDate = dates[0];
  const endDate   = dates[6];

  const ops = useClasses({ startDate, endDate, trainerId: trainerId || undefined });
  const { trainers } = useTrainers();

  // Build two maps:
  //   starts:    'date:time' → class object (class STARTS at that slot)
  //   covers:    'date:time' → class object (slot is COVERED by a class
  //                            that started earlier, e.g. 10:00 covered by
  //                            a 9:30 class)
  // Classes are 1h long, so a 9:30 class starts at 09:30 and covers 10:00.
  const { starts, covers } = useMemo(() => {
    const s = {};
    const c = {};
    ops.classes.forEach(cls => {
      s[`${cls.date}:${cls.time}`] = cls;
      // Compute the slot(s) the class covers beyond its starting slot.
      // 1 hour at half-hour granularity = 2 slots total, so cover 1 extra slot.
      const slotsToCover = CLASS_DURATION_MINUTES / 30 - 1; // = 1
      let t = cls.time;
      for (let i = 0; i < slotsToCover; i++) {
        t = addMinutes(t, 30);
        c[`${cls.date}:${t}`] = cls;
      }
    });
    return { starts: s, covers: c };
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
            {TIME_SLOTS.map(time => {
              const isHalfHour = time.endsWith(':30');
              return (
                <div key={time} style={{ display: 'contents' }}>
                  <div style={timeLabelCell(isHalfHour)}>{formatTime(time)}</div>
                  {dates.map(d => {
                    const startingClass = starts[`${d}:${time}`];
                    const coveringClass = covers[`${d}:${time}`];
                    return (
                      <ScheduleCell
                        key={d + time}
                        startingClass={startingClass}
                        coveringClass={coveringClass}
                        isHalfHour={isHalfHour}
                        onClick={() => {
                          if (startingClass)      setSelected(startingClass.id);
                          else if (coveringClass) setSelected(coveringClass.id);
                          else                    setPicker({ date: d, time });
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
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
                <button
                  onClick={() => setMobilePicker(d)}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${T.border}`,
                    color: T.primary,
                    borderRadius: 8,
                    padding: '5px 11px',
                    fontSize: '0.78rem',
                    fontFamily: T.sans,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <PlusCircle size={13} /> Add class
                </button>
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




        <MobileTimePicker
        date={mobilePicker}
        onClose={() => setMobilePicker(null)}
        onPick={(time) => {
          setPicker({ date: mobilePicker, time });
          setMobilePicker(null);
        }}
      />



      <AddClassModal
        open={!!picker}
        prefill={picker}
        onClose={() => setPicker(null)}
        ops={ops}
        existingClasses={ops.classes}
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

function ScheduleCell({ startingClass, coveringClass, isHalfHour, onClick }) {
  // A "covering" cell is one where a class is in progress but didn't start
  // here — it started in the previous slot.
  const classRef = startingClass || coveringClass;
  const isFull = classRef && (classRef.bookedCount || 0) >= (classRef.capacity || 6);
  const isCancelled = classRef?.status === 'cancelled';

  let bg = T.card, border = T.borderSoft, textColor = T.text;
  if (classRef) {
    if (isCancelled) { bg = '#F1E8E8'; border = '#D5BBBB'; textColor = T.muted; }
    else if (isFull) { bg = '#F5DDDD'; border = '#DDB0B0'; textColor = T.danger; }
    else             { bg = '#EEF3E6'; border = '#B6C997'; textColor = '#4E6A2E'; }
  }

  // For a covering cell, show a subtle continuation visual (no name/trainer
  // repeated — they're already in the starting cell).
  const showContent = !!startingClass;

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        // Visual cue for the boundary between hour and half-hour rows
        borderTopStyle: coveringClass ? 'dashed' : 'solid',
        margin: 2, padding: '6px 10px', minHeight: 48,
        borderRadius: 6, cursor: 'pointer',
        fontSize: '0.78rem', color: textColor,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      {showContent ? (
        <>
          <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{startingClass.name}</div>
          <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>{startingClass.trainer}</div>
          <div style={{ fontSize: '0.68rem', fontWeight: 500 }}>
            {startingClass.bookedCount || 0}/{startingClass.capacity || 6}
            {isCancelled && ' · cancelled'}
          </div>
        </>
      ) : coveringClass ? (
        // continuation cell — minimal label
        <div style={{ fontSize: '0.68rem', opacity: 0.65, textAlign: 'center', marginTop: 8 }}>
          ↑ continued
        </div>
      ) : (
        <div style={{ color: T.faint, textAlign: 'center', marginTop: 10 }}>
          <Plus size={13} />
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

function timeLabelCell(isHalfHour) {
  return {
    background:   T.bg,
    padding:      '6px 6px',
    textAlign:    'center',
    fontSize:     isHalfHour ? '0.66rem' : '0.74rem',
    color:        isHalfHour ? T.faint : T.muted,
    fontWeight:   isHalfHour ? 400 : 500,
    borderRight:  `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}




function MobileTimePicker({ date, onClose, onPick }) {
  if (!date) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(61,35,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          maxWidth: 400, width: '100%',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(61,35,20,0.25)',
        }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: `1px solid ${T.border}`,
        }}>
          <h2 style={{
            margin: 0, fontFamily: T.serif, fontWeight: 500,
            color: T.primary, fontSize: '1.35rem',
          }}>Pick a time</h2>
          <div style={{ fontSize: '0.84rem', color: T.muted, marginTop: 3 }}>
            {date}
          </div>
        </div>
        <div style={{
          padding: 16, overflowY: 'auto', flex: 1,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {TIME_SLOTS.map(time => (
            <button
              key={time}
              onClick={() => onPick(time)}
              style={{
                padding: '10px 6px',
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.text,
                fontSize: '0.9rem',
                fontFamily: T.sans,
                cursor: 'pointer',
              }}
            >
              {formatTime(time)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}