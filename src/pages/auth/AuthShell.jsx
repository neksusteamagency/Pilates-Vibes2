// Shared UI for auth pages: a centered card layout + a few primitives.

export const inp = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #E0D5C1', borderRadius: 8,
  background: '#F5F0E8', fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.92rem', color: '#2A1A0E',
  outline: 'none', boxSizing: 'border-box',
};

export const btnPrimary = {
  width: '100%', padding: '12px',
  background: '#3D2314', color: '#F5F0E8',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.92rem', fontWeight: 500,
};

export function Field({ label, children, hint }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: '0.74rem', fontWeight: 500,
        color: '#6B5744', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.72rem', color: '#9C8470', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#F5F0E8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#FAF7F2', borderRadius: 16,
        border: '1px solid #E0D5C1', padding: '34px 30px',
        boxShadow: '0 4px 30px rgba(61,35,20,0.10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{
            fontFamily: "'Cormorant Garant', serif",
            fontSize: '2rem', fontWeight: 500, color: '#3D2314',
            marginBottom: 6, letterSpacing: '0.01em',
          }}>
            Pilates Vibes
          </div>
          <div style={{
            fontFamily: "'Cormorant Garant', serif",
            fontSize: '1.3rem', color: '#3D2314', fontWeight: 500,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '0.84rem', color: '#9C8470', marginTop: 4 }}>
              {subtitle}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
