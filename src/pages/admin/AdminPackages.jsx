import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package as PackageIcon, Infinity as InfinityIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PageHeader, Card, Button, Modal, Field, Input, Badge, EmptyState, T,
} from '../../components/ui';
import { PRESET_PACKAGES } from '../../utils/packages';
import { useCustomPackages } from '../../hooks/usePackages';

export default function AdminPackages() {
  const { packages, loading, addCustomPackage, updateCustomPackage, removeCustomPackage } = useCustomPackages();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id, ...} = edit

  async function handleDelete(p) {
    if (!confirm(`Delete custom package "${p.name}"?`)) return;
    try { await removeCustomPackage(p.id); toast.success('Package deleted.'); }
    catch (e) { toast.error(e.message); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="Packages"
        subtitle="Preset packages are fixed. Custom packages let you sell anything else."
        right={<Button icon={Plus} onClick={() => setEditing({})}>New custom package</Button>}
      />

      {/* Preset packages */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
        fontWeight: 500, margin: '6px 0 14px',
      }}>Presets</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 32 }}>
        {PRESET_PACKAGES.map(p => <PackageCard key={p.id} pkg={p} preset />)}
      </div>

      {/* Custom packages */}
      <h2 style={{
        fontFamily: T.serif, fontSize: '1.3rem', color: T.primary,
        fontWeight: 500, margin: '6px 0 14px',
      }}>Custom Packages</h2>

      {loading ? (
        <div style={{ color: T.faint, padding: 20 }}>Loading…</div>
      ) : packages.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageIcon}
            title="No custom packages yet"
            hint='Click "New custom package" to add one (e.g. corporate plan, gift pack).'
          />
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {packages.map(p => (
            <PackageCard
              key={p.id}
              pkg={p}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      <PackageFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        pkg={editing}
        onSave={async (data) => {
          if (editing?.id) await updateCustomPackage(editing.id, data);
          else             await addCustomPackage(data);
        }}
      />
    </div>
  );
}

function PackageCard({ pkg, preset, onEdit, onDelete }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontFamily: T.serif, fontSize: '1.3rem', color: T.primary, fontWeight: 500 }}>
          {pkg.name}
        </div>
        {preset && <Badge bg="#EFE9DD" fg={T.muted}>Preset</Badge>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.6rem', color: T.primary, fontWeight: 500, fontFamily: T.serif }}>
          ${pkg.price}
        </span>
        <span style={{ fontSize: '0.85rem', color: T.faint }}>
          {pkg.unlimited ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <InfinityIcon size={14} /> unlimited sessions
            </span>
          ) : `${pkg.sessions} session${pkg.sessions === 1 ? '' : 's'}`}
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: T.muted }}>
        Valid for {pkg.durationDays || '—'} days{pkg.firstTimeOnly ? ' • first-time only' : ''}
      </div>
      {!preset && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Button size="sm" variant="secondary" icon={Edit2} onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="danger"    icon={Trash2} onClick={onDelete}>Delete</Button>
        </div>
      )}
    </Card>
  );
}

function PackageFormModal({ open, onClose, pkg, onSave }) {
  const [form, setForm] = useState({
    name: '', sessions: 1, price: 0, durationDays: 30, unlimited: false,
  });
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens (per pkg id)
  useEffect(() => {
    if (!open) return;
    setForm({
      name:         pkg?.name || '',
      sessions:     pkg?.sessions ?? 1,
      price:        pkg?.price ?? 0,
      durationDays: pkg?.durationDays ?? 30,
      unlimited:    !!pkg?.unlimited,
    });
  }, [open, pkg?.id]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (form.price < 0)     { toast.error('Price must be ≥ 0.'); return; }
    if (!form.unlimited && form.sessions < 1) { toast.error('Sessions must be ≥ 1.'); return; }

    setSaving(true);
    try {
      await onSave({
        name:         form.name.trim(),
        sessions:     form.unlimited ? 0 : Number(form.sessions),
        price:        Number(form.price),
        durationDays: Number(form.durationDays) || 30,
        unlimited:    form.unlimited,
      });
      toast.success(pkg?.id ? 'Package updated.' : 'Package created.');
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pkg?.id ? 'Edit custom package' : 'New custom package'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}
    >
      <Field label="Name" required>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Corporate 20-pack" />
      </Field>
      <Field label="Unlimited sessions?">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.unlimited} onChange={e => set('unlimited', e.target.checked)} />
          <span style={{ fontSize: '0.88rem', color: T.text }}>Yes, unlimited for the duration</span>
        </label>
      </Field>
      {!form.unlimited && (
        <Field label="Sessions" required>
          <Input type="number" min={1} value={form.sessions} onChange={e => set('sessions', e.target.value)} />
        </Field>
      )}
      <Field label="Price (USD)" required>
        <Input type="number" min={0} step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
      </Field>
      <Field label="Duration (days)" hint="How long the package is valid after purchase.">
        <Input type="number" min={1} value={form.durationDays} onChange={e => set('durationDays', e.target.value)} />
      </Field>
    </Modal>
  );
}
