import NotificationBell from './NotificationBell';
import { T } from './ui';

export default function TopBar() {
  return (
    <header
      className="topbar-desktop"
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.card,
        borderBottom: `1px solid ${T.border}`,
        padding: '10px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minHeight: 50,
      }}
    >
      <NotificationBell />
    </header>
  );
}
