import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth
import Login          from './pages/auth/Login';
import Signup         from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';

// Admin — Phase 2 real pages
import AdminSchedule   from './pages/admin/AdminSchedule';
import AdminClients    from './pages/admin/AdminClients';
import AdminPackages   from './pages/admin/AdminPackages';
import AdminAttendance from './pages/admin/AdminAttendance';

// Admin — Phase 3 real pages
import AdminTrainers from './pages/admin/AdminTrainers';

// Admin — existing user-provided pages (Phase 1)
import AdminPOS     from './pages/admin/AdminPOS';
import AdminFinance from './pages/admin/AdminFinance';
import AdminReports from './pages/admin/AdminReports';

// Placeholder that will be built in Phase 4
import AdminOverview from './pages/admin/AdminOverview';

// Trainer dashboard — Phase 3
import TrainerSchedule from './pages/trainer/TrainerSchedule';
import TrainerPayments from './pages/trainer/TrainerPayments';

// Client dashboard — Phase 3
import ClientProfile   from './pages/client/ClientProfile';
import ClientBook      from './pages/client/ClientBook';
import ClientHistory   from './pages/client/ClientHistory';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: "'DM Sans', sans-serif",
              fontSize:   '0.88rem',
              borderRadius: 8,
              background: '#FAF7F2',
              color:      '#2A1A0E',
              border:     '1px solid #E0D5C1',
            },
            success: { iconTheme: { primary: '#7C8C5E', secondary: '#FAF7F2' } },
            error:   { iconTheme: { primary: '#8C3A3A', secondary: '#FAF7F2' } },
          }}
        />
        <Routes>
          {/* Auth */}
          <Route path="/login"           element={<Login />} />
          <Route path="/signup"          element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Admin (protected) */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><Layout /></ProtectedRoute>}>
            <Route index             element={<AdminOverview />} />
            <Route path="schedule"   element={<AdminSchedule />} />
            <Route path="clients"    element={<AdminClients />} />
            <Route path="packages"   element={<AdminPackages />} />
            <Route path="trainers"   element={<AdminTrainers />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="pos"        element={<AdminPOS />} />
            <Route path="finance"    element={<AdminFinance />} />
            <Route path="reports"    element={<AdminReports />} />
          </Route>

          {/* Trainer (protected) */}
          <Route path="/trainer" element={<ProtectedRoute role="trainer"><Layout /></ProtectedRoute>}>
            <Route index           element={<TrainerSchedule />} />
            <Route path="payments" element={<TrainerPayments />} />
          </Route>

          {/* Client (protected) */}
          <Route path="/client" element={<ProtectedRoute role="client"><Layout /></ProtectedRoute>}>
            <Route index          element={<ClientProfile />} />
            <Route path="book"    element={<ClientBook />} />
            <Route path="history" element={<ClientHistory />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
