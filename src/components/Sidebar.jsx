import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navForRole } from './navConfig';

export default function Sidebar() {
  const { role, profile, currentUser, logout } = useAuth();
  const items = navForRole(role);
  const displayName = profile?.name || currentUser?.email || 'User';
  const roleLabel   = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  return (
    <aside
      className="sidebar-desktop"
      style={{
        width: 240,
        background: '#3D2314',
        borderRight: '1px solid #E0D5C1',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand */}
      <div style={{ padding: '24px 22px', borderBottom: '1px solid #E0D5C1' }}>
        <div style={{
          fontFamily: "'Cormorant Garant', serif",
          fontSize: '1.5rem', fontWeight: 500, color: '#F5F0E8',
          letterSpacing: '0.02em', lineHeight: 1.1,
        }}>
          Pilates Vibes
        </div>
        <div style={{
          fontSize: '0.7rem', color: '#F5F0E8',
          textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4,
        }}>
          {roleLabel}
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 14px', borderRadius: 8,
                fontSize: '0.88rem', fontFamily: "'DM Sans', sans-serif",
                color: isActive ? '#3D2314' : '#6B5744',
                background: isActive ? '#F5F0E8' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                marginBottom: 3,
                transition: 'all 0.15s',
              })}
            >
              <Icon size={16} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #E0D5C1' }}>
        <div style={{
          fontSize: '0.82rem', color: '#3D2314', fontWeight: 500, marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{displayName}</div>
        <div style={{
          fontSize: '0.7rem', color: '#9C8470', marginBottom: 10,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{currentUser?.email}</div>
        <button
          onClick={logout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 7, padding: '8px',
            background: 'transparent', color: '#8C3A3A',
            border: '1px solid #DDB0B0', borderRadius: 8,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.82rem', fontWeight: 500,
          }}
        >
          <LogOut size={13} /> Logout
        </button>
      </div>
    </aside>
  );
}
