import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Accepts either:
//   <ProtectedRoute role="admin">…</ProtectedRoute>
//   <ProtectedRoute allowedRoles={['admin']}>…</ProtectedRoute>
export default function ProtectedRoute({ role: requiredRole, allowedRoles, children }) {
  const { currentUser, role, loading } = useAuth();
  const location = useLocation();

  // Normalise into an array of allowed roles
  const allowed = allowedRoles || (requiredRole ? [requiredRole] : null);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F5F0E8',
        color: '#9C8470', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
      }}>
        Loading…
      </div>
    );
  }

  // Not signed in → kick to login (remember where they were going)
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in but role hasn't loaded yet (transient — usually means the
  // /users/{uid} doc is being created right after signup). Show a brief
  // loading state rather than bouncing them somewhere wrong.
  if (!role) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#F5F0E8',
        color: '#9C8470', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
      }}>
        Finishing sign-in…
      </div>
    );
  }

  // Signed in but wrong role → bounce to their own dashboard
  if (allowed && !allowed.includes(role)) {
    if (role === 'admin')   return <Navigate to="/admin"   replace />;
    if (role === 'trainer') return <Navigate to="/trainer" replace />;
    if (role === 'client')  return <Navigate to="/client"  replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
