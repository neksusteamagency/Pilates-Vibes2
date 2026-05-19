import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AuthShell, { Field, inp, btnPrimary } from './AuthShell';

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email.'); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      toast.success('Reset email sent.');
    } catch (err) {
      console.error(err);
      const code = err.code || '';
      const msg =
        code === 'auth/user-not-found' ? 'No account found with that email.'
        : code === 'auth/invalid-email' ? 'Invalid email address.'
        : err.message || 'Could not send reset email.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link">
      {sent ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            background: '#EEF3E6', color: '#4E6A2E',
            padding: '14px 16px', borderRadius: 8,
            fontSize: '0.88rem', marginBottom: 16,
          }}>
            ✓ Reset email sent to <strong>{email}</strong>
          </div>
          <p style={{ fontSize: '0.86rem', color: '#6B5744', lineHeight: 1.55, marginBottom: 20 }}>
            Check your inbox for instructions to reset your password.{' '}
            <strong>If you can't find the email, please check your spam folder.</strong>
          </p>
          <Link to="/login" style={{ color: '#A0673A', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <Field label="Email" hint="If you can't find the reset email, please check your spam folder.">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} autoComplete="email" />
            </Field>
            <button
              type="submit"
              disabled={loading}
              style={{ ...btnPrimary, marginTop: 18, opacity: loading ? 0.6 : 1, cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'Sending…' : 'Send reset email'}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.84rem' }}>
            <Link to="/login" style={{ color: '#A0673A', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
