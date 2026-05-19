import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { T } from './ui';

export default function NotificationBell() {
  const { currentUser } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, removeNotification } =
    useNotifications(currentUser?.uid);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!currentUser) return null;

  return (
    <div ref={popoverRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 8,
          color: T.muted,
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.bg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4, right: 4,
            background: T.warm,
            color: T.bg,
            fontSize: '0.65rem',
            fontWeight: 600,
            minWidth: 16, height: 16,
            borderRadius: 100,
            padding: '0 5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: T.sans,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 360,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '70vh',
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(61,35,20,0.18)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{
              margin: 0, fontFamily: T.serif, fontWeight: 500,
              fontSize: '1.1rem', color: T.primary,
            }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: T.warm, fontSize: '0.78rem',
                  fontFamily: T.sans, display: 'inline-flex',
                  alignItems: 'center', gap: 4,
                }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: T.faint,
                fontSize: '0.88rem',
              }}>
                <Bell size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>No notifications yet.</div>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={() => markRead(n.id)}
                  onRemove={() => removeNotification(n.id)}
                  onClose={() => setOpen(false)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification, onMarkRead, onRemove, onClose }) {
  const { id, title, body, link, read, createdAt, kind } = notification;

  const inner = (
    <>
      <div style={{
        position: 'absolute', top: 14, left: 10,
        width: 7, height: 7, borderRadius: '50%',
        background: read ? 'transparent' : T.warm,
      }} />
      <div style={{ paddingLeft: 14 }}>
        <div style={{
          fontSize: '0.9rem',
          fontWeight: read ? 400 : 500,
          color: T.text,
          marginBottom: 2,
        }}>{title}</div>
        {body && (
          <div style={{ fontSize: '0.82rem', color: T.muted, lineHeight: 1.35 }}>
            {body}
          </div>
        )}
        <div style={{ fontSize: '0.72rem', color: T.faint, marginTop: 4 }}>
          {formatRelative(createdAt)}
        </div>
      </div>
    </>
  );

  return (
    <div style={{
      position: 'relative',
      padding: '12px 14px 12px 22px',
      borderBottom: `1px solid ${T.borderSoft}`,
      background: read ? 'transparent' : `${T.bg}cc`,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
    }}>
      {link ? (
        <Link
          to={link}
          onClick={() => { if (!read) onMarkRead(); onClose(); }}
          style={{ flex: 1, textDecoration: 'none', color: 'inherit', position: 'relative' }}
        >
          {inner}
        </Link>
      ) : (
        <div style={{ flex: 1, position: 'relative' }} onClick={() => !read && onMarkRead()}>
          {inner}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!read && (
          <button
            onClick={onMarkRead}
            title="Mark read"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 2 }}
          ><Check size={14} /></button>
        )}
        <button
          onClick={onRemove}
          title="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.faint, padding: 2 }}
        ><X size={13} /></button>
      </div>
    </div>
  );
}

function formatRelative(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)    return `${days}d ago`;
  return d.toLocaleDateString();
}
