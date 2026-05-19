import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <div
        className="layout-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          minHeight: '100vh',
        }}
      >
        <Sidebar />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <MobileNav />
          <TopBar />
          <main style={{ flex: 1 }}>
            <Outlet />
          </main>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .layout-grid     { grid-template-columns: 1fr !important; }
          .sidebar-desktop { display: none !important; }
          .topbar-desktop  { display: none !important; }
        }
        @media (min-width: 901px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
