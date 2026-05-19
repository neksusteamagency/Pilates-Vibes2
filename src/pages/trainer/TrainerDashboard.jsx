import { useAuth } from '../../contexts/AuthContext';

export default function TrainerDashboard() {
  const { profile, currentUser } = useAuth();
  const name = profile?.name || currentUser?.email;

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{
        fontFamily: "'Cormorant Garant', serif",
        fontWeight: 500, color: '#3D2314',
        fontSize: '2rem', margin: 0,
      }}>
        Schedule
      </h1>
      <p style={{
        color: '#9C8470',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.92rem', marginTop: 8,
      }}>
        Welcome, {name}. Your weekly schedule and payments tab will be
        built out in Phase 3.
      </p>
    </div>
  );
}
