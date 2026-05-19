import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navForRole } from './navConfig';
import NotificationBell from './NotificationBell';

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const { role, profile, currentUser, logout } = useAuth();
  const items = navForRole(role);
  const displayName = profile?.name || currentUser?.email || 'User';
  const roleLabel   = role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

  return (
    <>
      <header
        className="mobile-nav"
        style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: '#FAF7F2', borderBottom: '1px solid #E0D5C1',
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{
          fontFamily: "'Cormorant Garant', serif",
          fontSize: '1.3rem', fontWeight: 500, color: '#3D2314',
        }}>
          Pilates Vibes
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <NotificationBell />
          <button
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3D2314', padding: 4 }}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(61,35,20,0.4)',
          }}
          onClick={() => setOpen(false)}
        >
          <aside
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: '78%', maxWidth: 280,
              background: '#FAF7F2',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 40px rgba(61,35,20,0.2)',
            }}
          >
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid #E0D5C1',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: "'Cormorant Garant', serif", fontSize: '1.2rem', color: '#3D2314' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#9C8470', marginTop: 2 }}>{roleLabel}</div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B5744', padding: 4 }}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
              {items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: isActive ? '#3D2314' : '#6B5744',
                      background: isActive ? '#F5F0E8' : 'transparent',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '0.92rem',
                      fontWeight: isActive ? 500 : 400,
                      marginBottom: 2,
                    })}
                  >
                    {Icon && <Icon size={17} />}
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            <button
              onClick={() => { logout(); setOpen(false); }}
              style={{
                margin: '12px 16px 20px',
                padding: '10px 14px',
                background: 'transparent',
                border: '1px solid #E0D5C1',
                borderRadius: 8,
                color: '#8C3A3A',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.88rem',
                display: 'flex', alignItems: 'center', gap: 7,
                justifyContent: 'center',
              }}
            >
              <LogOut size={15} /> Log out
            </button>
          </aside>
        </div>
      )}
    </>
  );
}
