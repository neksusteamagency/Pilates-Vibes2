import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Users, ClipboardCheck, AlertCircle, TrendingDown,
  Clock, ArrowRight, CheckCircle, XCircle, Snowflake,
} from 'lucide-react';
import {
  PageHeader, Card, Badge, EmptyState, T,
} from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useClasses } from '../../hooks/useClasses';
import { useClients } from '../../hooks/useClients';
import { useAttendance } from '../../hooks/useAttendance';
import {
  formatTime, todayString, addDays, isClassStarted, weekDates,
} from '../../utils/dates';
import { statusLabel, statusColors } from '../../utils/status';

export default function AdminOverview() {
  const { profile } = useAuth();
  const today = todayString();

  // This-week window for class counts + attendance %
  const week = useMemo(() => weekDates(today), [today]);

  // Today's classes
  const { classes: todayClasses, loading: classesLoading } =
    useClasses({ startDate: today, endDate: today });

  // Week's classes (for week metrics)
  const { classes: weekClasses } =
    useClasses({ startDate: week[0], endDate: week[6] });

  // Week's attendance
  const { attendance: weekAttendance } =
    useAttendance({ startDate: week[0], endDate: week[6] });

  // All clients
  const { clients, loading: clientsLoading } = useClients();

  // ── Today's class timeline ────────────────────────────────────
  const sortedToday = useMemo(
    () => [...todayClasses].sort((a, b) => a.time.localeCompare(b.time)),
    [todayClasses],
  );
  const todayBookings = todayClasses.reduce((s, c) => s + (c.bookedCount || 0), 0);
  const todayCapacity = todayClasses.reduce((s, c) => s + (c.capacity || 6), 0);

  // ── Week metrics ──────────────────────────────────────────────
  const weekTotalClasses    = weekClasses.length;
  const weekTotalBookings   = weekClasses.reduce((s, c) => s + (c.bookedCount || 0), 0);
  const weekAttendedCount   = weekAttendance.filter(a => a.status === 'attended').length;
  const weekNoShowCount     = weekAttendance.filter(a => a.status === 'no-show').length;
  const weekAttendanceTotal = weekAttendedCount + weekNoShowCount;
  const weekAttendancePct   = weekAttendanceTotal === 0
    ? null
    : Math.round((weekAttendedCount / weekAttendanceTotal) * 100);

  // ── Client metrics ────────────────────────────────────────────
  const activeClients   = clients.filter(c => c.status === 'active');
  const lowClients      = clients.filter(c => c.status === 'low');
  const expiringClients = clients.filter(c => c.status === 'expiring');
  const expiredClients  = clients.filter(c => c.status === 'expired');
  const frozenClients   = clients.filter(c => c.status === 'frozen');
  const unpaidClients   = clients.filter(c => c.pkg && !c.pkgPaid);

  // Most-recent signups (clients with no package OR very new)
  const recentClients = useMemo(() =>
    [...clients]
      .filter(c => c.createdAt?.toDate)
      .sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate())
      .slice(0, 5)
  , [clients]);

  const firstName = profile?.name?.split(' ')[0] || 'there';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {/* Today summary cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        <Metric
          icon={Calendar}
          label="Classes today"
          value={classesLoading ? '…' : todayClasses.length}
          color={T.primary}
        />
        <Metric
          icon={Users}
          label="Bookings today"
          value={classesLoading ? '…' : todayBookings}
          sublabel={todayCapacity > 0 ? `of ${todayCapacity} capacity` : null}
          color={T.warm}
        />
        <Metric
          icon={ClipboardCheck}
          label="Week attendance"
          value={weekAttendancePct === null ? '—' : `${weekAttendancePct}%`}
          sublabel={`${weekAttendedCount} of ${weekAttendanceTotal} marked`}
          color={T.olive}
        />
        <Metric
          icon={Users}
          label="Active clients"
          value={clientsLoading ? '…' : activeClients.length}
          sublabel={`of ${clients.length} total`}
          color={T.primary}
        />
      </div>

      {/* Two-column layout: today's timeline + client watchlists */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 18,
      }} className="overview-grid">
        {/* LEFT — today's classes */}
        <div>
          <SectionHeader
            title="Today's classes"
            right={<LinkArrow to="/admin/schedule" label="Schedule" />}
          />

          {classesLoading ? (
            <Card><div style={{ color: T.faint, padding: 16, textAlign: 'center' }}>Loading…</div></Card>
          ) : sortedToday.length === 0 ? (
            <Card>
              <EmptyState
                icon={Calendar}
                title="No classes today"
                hint="Enjoy the quiet day, or add some classes from the Schedule page."
              />
            </Card>
          ) : (
            <Card style={{ padding: 0 }}>
              {sortedToday.map((c, i) => (
                <ClassRow
                  key={c.id}
                  classRef={c}
                  isFirst={i === 0}
                />
              ))}
            </Card>
          )}

          {/* Week summary */}
          <SectionHeader title="This week" style={{ marginTop: 28 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MiniMetric label="Total classes"  value={weekTotalClasses} />
            <MiniMetric label="Total bookings" value={weekTotalBookings} />
            <MiniMetric label="Attended"       value={weekAttendedCount} color={T.olive} />
            <MiniMetric label="No-shows"       value={weekNoShowCount}   color={T.danger} />
          </div>
        </div>

        {/* RIGHT — watchlists */}
        <div>
          {/* Client status breakdown */}
          <SectionHeader
            title="Clients at a glance"
            right={<LinkArrow to="/admin/clients" label="Manage" />}
          />
          <Card style={{ marginBottom: 20 }}>
            <StatusRow status="active"     count={activeClients.length} />
            <StatusRow status="low"        count={lowClients.length} />
            <StatusRow status="expiring"   count={expiringClients.length} />
            <StatusRow status="expired"    count={expiredClients.length} />
            <StatusRow status="frozen"     count={frozenClients.length} />
            <StatusRow status="unpaid"     count={unpaidClients.length} last />
          </Card>

          {/* Action lists */}
          {lowClients.length > 0 && (
            <>
              <SectionHeader
                title="Running low on sessions"
                badge={`${lowClients.length}`}
              />
              <Card style={{ marginBottom: 18, padding: 0 }}>
                {lowClients.slice(0, 5).map((c, i) => (
                  <ClientRow
                    key={c.id}
                    name={c.name}
                    detail={`${c.pkgSessions} session${c.pkgSessions === 1 ? '' : 's'} left`}
                    icon={TrendingDown}
                    iconColor={T.warm}
                    isFirst={i === 0}
                  />
                ))}
                {lowClients.length > 5 && <MoreRow to="/admin/clients" count={lowClients.length - 5} />}
              </Card>
            </>
          )}

          {expiringClients.length > 0 && (
            <>
              <SectionHeader
                title="Expiring soon"
                badge={`${expiringClients.length}`}
              />
              <Card style={{ marginBottom: 18, padding: 0 }}>
                {expiringClients.slice(0, 5).map((c, i) => (
                  <ClientRow
                    key={c.id}
                    name={c.name}
                    detail={`expires ${c.pkgExpiry}`}
                    icon={Clock}
                    iconColor={T.warm}
                    isFirst={i === 0}
                  />
                ))}
                {expiringClients.length > 5 && <MoreRow to="/admin/clients" count={expiringClients.length - 5} />}
              </Card>
            </>
          )}

          {unpaidClients.length > 0 && (
            <>
              <SectionHeader
                title="Pending payment"
                badge={`${unpaidClients.length}`}
              />
              <Card style={{ marginBottom: 18, padding: 0 }}>
                {unpaidClients.slice(0, 5).map((c, i) => (
                  <ClientRow
                    key={c.id}
                    name={c.name}
                    detail={c.pkg}
                    icon={AlertCircle}
                    iconColor={T.danger}
                    isFirst={i === 0}
                  />
                ))}
                {unpaidClients.length > 5 && <MoreRow to="/admin/clients" count={unpaidClients.length - 5} />}
              </Card>
            </>
          )}

          {recentClients.length > 0 && (
            <>
              <SectionHeader title="Recent signups" />
              <Card style={{ padding: 0 }}>
                {recentClients.map((c, i) => (
                  <ClientRow
                    key={c.id}
                    name={c.name}
                    detail={c.pkg || 'No package yet'}
                    icon={Users}
                    iconColor={T.muted}
                    isFirst={i === 0}
                  />
                ))}
              </Card>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .overview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────

function Metric({ icon: Icon, label, value, sublabel, color }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{
          fontSize: '0.74rem', textTransform: 'uppercase',
          letterSpacing: '0.08em', color: T.muted,
        }}>{label}</div>
        {Icon && <Icon size={16} color={T.faint} />}
      </div>
      <div style={{
        fontFamily: T.serif, fontSize: '2.1rem',
        color: color || T.primary,
        fontWeight: 500, lineHeight: 1,
      }}>{value}</div>
      {sublabel && (
        <div style={{ fontSize: '0.78rem', color: T.faint, marginTop: 6 }}>
          {sublabel}
        </div>
      )}
    </Card>
  );
}

function MiniMetric({ label, value, color }) {
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

function SectionHeader({ title, right, badge, style }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      margin: '0 0 10px', gap: 10, ...style,
    }}>
      <h2 style={{
        margin: 0, fontFamily: T.serif, fontSize: '1.3rem',
        color: T.primary, fontWeight: 500,
      }}>
        {title}
        {badge && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: T.muted, fontWeight: 400 }}>{badge}</span>}
      </h2>
      {right}
    </div>
  );
}

function LinkArrow({ to, label }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.82rem', color: T.warm,
        textDecoration: 'none', fontFamily: T.sans,
      }}
    >
      {label} <ArrowRight size={13} />
    </Link>
  );
}

function ClassRow({ classRef, isFirst }) {
  const isFull = (classRef.bookedCount || 0) >= (classRef.capacity || 6);
  const isCancelled = classRef.status === 'cancelled';
  const isStarted = isClassStarted(classRef.date, classRef.time);

  return (
    <div style={{
      padding: '14px 16px',
      borderTop: isFirst ? 'none' : `1px solid ${T.borderSoft}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 12, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 180 }}>
        <div style={{
          fontFamily: T.serif, fontSize: '1.05rem',
          color: isStarted ? T.muted : T.primary,
          minWidth: 70, fontWeight: 500,
        }}>
          {formatTime(classRef.time)}
        </div>
        <div>
          <div style={{ fontSize: '0.92rem', color: T.text, fontWeight: 500 }}>{classRef.name}</div>
          <div style={{ fontSize: '0.78rem', color: T.faint }}>{classRef.trainer}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isCancelled ? (
          <Badge bg="#F5DDDD" fg={T.danger}>Cancelled</Badge>
        ) : (
          <Badge
            bg={isFull ? '#F5DDDD' : '#EEF3E6'}
            fg={isFull ? T.danger : T.olive}
          >
            {classRef.bookedCount || 0} / {classRef.capacity || 6}
          </Badge>
        )}
        {isStarted && !isCancelled && (
          <Badge bg="#EFE9DD" fg={T.muted}>Started</Badge>
        )}
      </div>
    </div>
  );
}

function StatusRow({ status, count, last }) {
  const colors = status === 'unpaid'
    ? { bg: '#F5DDDD', fg: T.danger }
    : statusColors(status);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
      borderBottom: last ? 'none' : `1px solid ${T.borderSoft}`,
    }}>
      <Badge {...colors}>{status === 'unpaid' ? 'Unpaid' : statusLabel(status)}</Badge>
      <span style={{
        fontFamily: T.serif, fontSize: '1.2rem', color: T.text, fontWeight: 500,
      }}>{count}</span>
    </div>
  );
}

function ClientRow({ name, detail, icon: Icon, iconColor, isFirst }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderTop: isFirst ? 'none' : `1px solid ${T.borderSoft}`,
    }}>
      <Icon size={14} color={iconColor} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.9rem', color: T.text, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: '0.76rem', color: T.faint }}>{detail}</div>
      </div>
    </div>
  );
}

function MoreRow({ to, count }) {
  return (
    <Link
      to={to}
      style={{
        display: 'block', textAlign: 'center',
        padding: '10px', borderTop: `1px solid ${T.borderSoft}`,
        fontSize: '0.82rem', color: T.warm,
        textDecoration: 'none', fontFamily: T.sans,
      }}
    >
      +{count} more →
    </Link>
  );
}
