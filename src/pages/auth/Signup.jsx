import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { isValidLebanesePhone } from '../../utils/phone';
import AuthShell, { Field, inp, btnPrimary } from './AuthShell';

export default function Signup() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    password: '', confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const { signupClient } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.password) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!isValidLebanesePhone(form.phone)) {
      toast.error('Please enter a valid Lebanese phone number.');
      return;
    }

    setLoading(true);
    try {
      const { linked } = await signupClient(form);
      toast.success(
        linked
          ? 'Welcome back! Your existing profile is now linked.'
          : 'Account created. Welcome!'
      );
      navigate('/client', { replace: true });
    } catch (err) {
      console.error(err);
      const code = err.code || '';
      const msg =
        code === 'auth/email-already-in-use' ? 'This email is already registered. Please sign in.'
        : code === 'auth/invalid-email'      ? 'Invalid email address.'
        : code === 'auth/weak-password'      ? 'Password is too weak. Use at least 6 characters.'
        : err.message || 'Sign up failed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Join Pilates Vibes">
      <form onSubmit={handleSubmit}>
        <Field label="Full name">
          <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} autoComplete="name" />
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Email">
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inp} autoComplete="email" />
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Phone number" hint="Lebanese number — any format works (70 111 222 or +961…)">
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            style={inp}
            autoComplete="tel"
            placeholder="70 111 222"
          />
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Password">
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} style={inp} autoComplete="new-password" />
        </Field>
        <div style={{ height: 12 }} />

        <Field label="Confirm password">
          <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} style={inp} autoComplete="new-password" />
        </Field>

        <button
          type="submit"
          disabled={loading}
          style={{ ...btnPrimary, marginTop: 20, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.84rem', color: '#6B5744' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#A0673A', textDecoration: 'none', fontWeight: 500 }}>
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
