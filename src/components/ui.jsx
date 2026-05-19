// Tiny UI primitives shared across admin pages. Keeps style consistent.

import { X } from 'lucide-react';

// ── Tokens ──────────────────────────────────────────────────────
export const T = {
  bg:         '#F5F0E8',
  card:       '#FAF7F2',
  border:     '#E0D5C1',
  borderSoft: '#EDE5D5',
  primary:    '#3D2314',
  warm:       '#A0673A',
  olive:      '#7C8C5E',
  danger:     '#8C3A3A',
  text:       '#2A1A0E',
  muted:      '#6B5744',
  faint:      '#9C8470',
  serif:      "'Cormorant Garant', serif",
  sans:       "'DM Sans', sans-serif",
};

// ── Button ──────────────────────────────────────────────────────
export function Button({ variant = 'primary', size = 'md', icon: Icon, children, style, ...rest }) {
  const base = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            7,
    border:         'none',
    borderRadius:   8,
    cursor:         rest.disabled ? 'not-allowed' : 'pointer',
    opacity:        rest.disabled ? 0.55 : 1,
    fontFamily:     T.sans,
    fontWeight:     500,
    transition:     'all 0.15s',
    whiteSpace:     'nowrap',
  };
  const sizes = {
    sm: { padding: '6px 12px',  fontSize: '0.8rem'  },
    md: { padding: '9px 16px',  fontSize: '0.88rem' },
    lg: { padding: '12px 22px', fontSize: '0.95rem' },
  };
  const variants = {
    primary:   { background: T.primary, color: T.bg, border: 'none' },
    secondary: { background: 'transparent', color: T.primary, border: `1px solid ${T.border}` },
    danger:    { background: 'transparent', color: T.danger, border: '1px solid #DDB0B0' },
    ghost:     { background: 'transparent', color: T.muted, border: 'none' },
    olive:     { background: T.olive, color: T.bg, border: 'none' },
    warm:      { background: T.warm, color: T.bg, border: 'none' },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant], ...style }} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 13 : 15} />}
      {children}
    </button>
  );
}

// ── Inputs ──────────────────────────────────────────────────────
export const inputStyle = {
  width:        '100%',
  padding:      '10px 13px',
  border:       `1.5px solid ${T.border}`,
  borderRadius: 8,
  background:   T.bg,
  fontFamily:   T.sans,
  fontSize:     '0.9rem',
  color:        T.text,
  outline:      'none',
  boxSizing:    'border-box',
};
export const Input    = (p) => <input    {...p} style={{ ...inputStyle, ...(p.style || {}) }} />;
export const Select   = (p) => <select   {...p} style={{ ...inputStyle, ...(p.style || {}) }} />;
export const Textarea = (p) => <textarea {...p} style={{ ...inputStyle, resize: 'vertical', minHeight: 80, ...(p.style || {}) }} />;

export function Field({ label, hint, children, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block', fontSize: '0.74rem', fontWeight: 500,
        color: T.muted, textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: T.danger }}> *</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: '0.72rem', color: T.faint, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────
export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:   T.card,
      border:       `1px solid ${T.border}`,
      borderRadius: 14,
      padding:      '20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────
export function Badge({ children, bg = '#EFE9DD', fg = T.muted, style }) {
  return (
    <span style={{
      display:       'inline-block',
      padding:       '3px 10px',
      background:    bg,
      color:         fg,
      fontSize:      '0.74rem',
      fontWeight:    500,
      borderRadius:  100,
      letterSpacing: '0.02em',
      whiteSpace:    'nowrap',
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Page header ─────────────────────────────────────────────────
export function PageHeader({ title, subtitle, right }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', gap: 16,
      marginBottom: 22, flexWrap: 'wrap',
    }}>
      <div>
        <h1 style={{
          fontFamily: T.serif, fontWeight: 500, color: T.primary,
          fontSize: '2rem', margin: 0, lineHeight: 1.1,
        }}>{title}</h1>
        {subtitle && <p style={{ color: T.faint, fontSize: '0.9rem', margin: '6px 0 0' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 540, footer }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(61,35,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   T.card,
          borderRadius: 16,
          border:       `1px solid ${T.border}`,
          maxWidth,     width: '100%',
          maxHeight:    '90vh',
          display:      'flex', flexDirection: 'column',
          boxShadow:    '0 10px 40px rgba(61,35,20,0.25)',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 22px', borderBottom: `1px solid ${T.border}`,
        }}>
          <h2 style={{
            margin: 0, fontFamily: T.serif, fontWeight: 500,
            color: T.primary, fontSize: '1.35rem',
          }}>{title}</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: T.muted, padding: 4, borderRadius: 6,
          }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: '14px 22px', borderTop: `1px solid ${T.border}`,
            display: 'flex', gap: 10, justifyContent: 'flex-end',
            background: T.bg,
            borderRadius: '0 0 16px 16px',
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: T.faint }}>
      {Icon && <Icon size={36} style={{ marginBottom: 12, opacity: 0.5 }} />}
      <div style={{
        fontFamily: T.serif, fontSize: '1.2rem',
        color: T.primary, marginBottom: 4,
      }}>{title}</div>
      {hint && <div style={{ fontSize: '0.88rem' }}>{hint}</div>}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────
export function Tabs({ value, onChange, options }) {
  return (
    <div style={{
      display: 'flex', gap: 4,
      borderBottom: `1px solid ${T.border}`,
      marginBottom: 18,
      overflowX: 'auto',
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px',
              fontFamily: T.sans,
              fontSize: '0.88rem',
              fontWeight: active ? 600 : 400,
              color: active ? T.primary : T.muted,
              borderBottom: active ? `2px solid ${T.primary}` : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
