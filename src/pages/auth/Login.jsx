import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell, { Field, inp, btnPrimary } from './AuthShell';

// Map role → landing page
function homeForRole(role) {
  if (role === 'admin')   return '/admin';
  if (role === 'trainer') return '/trainer';
  if (role === 'client')  return '/client';
  return null;
}

export default function Login() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [pendingNav, setPending]  = useState(false); // true while we wait for role
  const { login, currentUser, role, loading: authLoading } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // After login succeeds, the AuthContext re-fetches the role asynchronously.
  // We have to wait until BOTH currentUser is set AND role is resolved before
  // navigating, otherwise we'd send the user to '/' which loops back here.
  useEffect(() => {
    if (!pendingNav) return;
    if (authLoading) return;            // still loading user/role
    if (!currentUser) return;            // not logged in yet
    if (!role)       return;             // role doc not loaded yet
    const home = homeForRole(role);
    const from = location.state?.from?.pathname;
    const target = from && from !== '/' && from !== '/login' ? from : home;
    if (target) {
      setPending(false);
      navigate(target, { replace: true });
    }
  }, [pendingNav, authLoading, currentUser, role, location.state, navigate]);

  // If the user lands on /login while already signed in, send them home
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !role) return;
    if (pendingNav) return; // login flow handles it
    const home = homeForRole(role);
    if (home) navigate(home, { replace: true });
  }, [authLoading, currentUser, role, navigate, pendingNav]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      // Don't navigate yet — let the effect above run once role is loaded.
      setPending(true);
    } catch (err) {
      console.error(err);
      const code = err.code || '';
      const msg =
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Invalid email or password.'
          : code.includes('too-many-requests')
            ? 'Too many attempts. Try again later.'
            : err.message || 'Login failed.';
      toast.error(msg);
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={handleSubmit}>
        <Field label="Email">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} autoComplete="email" />
        </Field>
        <div style={{ height: 14 }} />
        <Field label="Password">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} autoComplete="current-password" />
        </Field>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: '#A0673A', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading || pendingNav}
          style={{ ...btnPrimary, marginTop: 18, opacity: (loading || pendingNav) ? 0.6 : 1, cursor: (loading || pendingNav) ? 'wait' : 'pointer' }}
        >
          {loading ? 'Signing in…' : pendingNav ? 'Loading your dashboard…' : 'Sign in'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.84rem', color: '#6B5744' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: '#A0673A', textDecoration: 'none', fontWeight: 500 }}>
          Sign up
        </Link>
      </div>
    </AuthShell>
  );
}
