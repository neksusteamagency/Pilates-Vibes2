import { useState, useMemo, useEffect } from 'react';
import { Plus, Search, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Modal, Field, Input, Badge, EmptyState, T,
} from '../../components/ui';
import { useClients } from '../../hooks/useClients';
import { useCustomPackages } from '../../hooks/usePackages';
import { formatPhone, isValidLebanesePhone } from '../../utils/phone';
import { statusLabel, statusColors } from '../../utils/status';
import ClientDrawer from './components/ClientDrawer';

const FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'active',     label: 'Active' },
  { value: 'low',        label: 'Low sessions' },
  { value: 'expiring',   label: 'Expiring soon' },
  { value: 'expired',    label: 'Expired' },
  { value: 'frozen',     label: 'Frozen' },
  { value: 'unpaid',     label: 'Unpaid' },
  { value: 'no-package', label: 'No package' },
];

export default function AdminClients() {
  const ops             = useClients();
  const { packages: customPackages } = useCustomPackages();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [open,   setOpen]     = useState(null); // selected clientId
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return ops.clients.filter(c => {
      if (s) {
        const hay = `${c.name || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (filter === 'all')    return true;
      if (filter === 'unpaid') return c.pkg && !c.pkgPaid;
      return c.status === filter;
    });
  }, [ops.clients, search, filter]);

  const selectedClient = open ? ops.clients.find(c => c.id === open) : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Clients"
        subtitle={`${ops.clients.length} total`}
        right={<Button icon={UserPlus} onClick={() => setNewOpen(true)}>New client</Button>}
      />

      {/* Search + filters */}
      <Card style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: T.faint }} />
          <Input
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                style={{
                  border: `1px solid ${active ? T.primary : T.border}`,
                  background: active ? T.primary : 'transparent',
                  color:      active ? T.bg : T.muted,
                  borderRadius: 100, padding: '5px 13px',
                  fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: T.sans,
                }}
              >{f.label}</button>
            );
          })}
        </div>
      </Card>

      {/* Table */}
      {ops.loading ? (
        <Card><div style={{ color: T.faint, padding: 20, textAlign: 'center' }}>Loading…</div></Card>
      ) : !filtered.length ? (
        <Card><EmptyState
          icon={UserPlus}
          title={search || filter !== 'all' ? 'No matches' : 'No clients yet'}
          hint={search || filter !== 'all' ? 'Try adjusting search or filters.' : 'Click "New client" to add one.'}
        /></Card>
      ) : (
        <Card style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.sans }}>
            <thead>
              <tr style={{ background: T.bg }}>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Package</Th>
                <Th>Sessions</Th>
                <Th>Expiry</Th>
                <Th>Status</Th>
                <Th>Paid</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => setOpen(c.id)}
                  style={{ cursor: 'pointer', borderTop: `1px solid ${T.borderSoft}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Td><strong>{c.name}</strong></Td>
                  <Td style={{ color: T.muted }}>{c.phone ? formatPhone(c.phone) : '—'}</Td>
                  <Td>{c.pkg || <span style={{ color: T.faint }}>—</span>}</Td>
                  <Td>{!c.pkg ? '—' : c.pkgUnlimited ? '∞' : c.pkgSessions}</Td>
                  <Td style={{ color: T.muted }}>{c.pkgExpiry || '—'}</Td>
                  <Td><Badge {...statusColors(c.status)}>{statusLabel(c.status)}</Badge></Td>
                  <Td>
                    {!c.pkg ? '—' :
                      c.pkgPaid ? <Badge bg="#EEF3E6" fg={T.olive}>{c.pkgPaymentMethod}</Badge>
                                : <Badge bg="#F5DDDD" fg={T.danger}>Unpaid</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ClientDrawer
        open={!!selectedClient}
        client={selectedClient}
        onClose={() => setOpen(null)}
        ops={ops}
        customPackages={customPackages}
      />

      <NewClientModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={ops.addClient}
      />
    </div>
  );
}

function Th({ children }) {
  return <th style={{
    textAlign: 'left', padding: '11px 14px',
    fontSize: '0.74rem', color: T.muted, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }}>{children}</th>;
}

function Td({ children, style }) {
  return <td style={{ padding: '11px 14px', fontSize: '0.88rem', color: T.text, ...style }}>{children}</td>;
}

function NewClientModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '2000-01-01', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: '', phone: '', email: '', birthday: '2000-01-01', notes: '' });
  }, [open]);

  async function submit() {
    if (!form.name.trim())                                { toast.error('Name is required.'); return; }
    if (form.phone && !isValidLebanesePhone(form.phone))   { toast.error('Enter a valid Lebanese phone.'); return; }
    setSaving(true);
    try {
      await onCreate(form);
      toast.success('Client created.');
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New client"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Plus} onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
      </>}
    >
      <Field label="Full name" required>
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </Field>
      <Field label="Phone" hint="Lebanese — any format works.">
        <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="70 111 222" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </Field>
      <Field label="Birthday">
        <Input type="date" value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
      </Field>
    </Modal>
  );
}
