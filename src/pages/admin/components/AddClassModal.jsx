import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Button, Modal, Field, Input, Select, T,
} from '../../../components/ui';
import { useTrainers } from '../../../hooks/useTrainers';
import { createRecurrence } from '../../../hooks/useRecurrenceRules';
import { dayOfWeek, formatDateLong } from '../../../utils/dates';

export default function AddClassModal({ open, onClose, prefill, ops }) {
  // prefill = { date, time }
  const { trainers } = useTrainers();
  const [form, setForm] = useState({
    name: '', trainerId: '', capacity: 6, recurring: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ name: '', trainerId: '', capacity: 6, recurring: false });
  }, [open]);

  if (!open || !prefill) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const trainer = trainers.find(t => t.id === form.trainerId);

  async function submit() {
    if (!form.name.trim()) { toast.error('Class name is required.'); return; }
    if (!form.trainerId)   { toast.error('Pick a trainer.'); return; }

    setSaving(true);
    try {
      const data = {
        name:      form.name.trim(),
        date:      prefill.date,
        time:      prefill.time,
        trainer:   trainer?.name || '',
        trainerId: form.trainerId,
        capacity:  Number(form.capacity) || 6,
        dayOfWeek: dayOfWeek(prefill.date),
      };
      if (form.recurring) {
        await createRecurrence({
          name:      data.name,
          time:      data.time,
          dayOfWeek: data.dayOfWeek,
          trainer:   data.trainer,
          trainerId: data.trainerId,
          capacity:  data.capacity,
          startDate: data.date,
        });
        toast.success('Recurring class created (12 weeks materialised).');
      } else {
        await ops.addClass(data);
        toast.success('Class created.');
      }
      onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New class"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Create class'}</Button>
      </>}
    >
      <div style={{
        background: T.bg, padding: '10px 14px', borderRadius: 8,
        fontSize: '0.86rem', color: T.text, marginBottom: 14,
      }}>
        {formatDateLong(prefill.date)} at <strong>{prefill.time}</strong>
      </div>

      <Field label="Class name" required>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Reformer, Mat, Tower" />
      </Field>
      <Field label="Trainer" required>
        <Select value={form.trainerId} onChange={e => set('trainerId', e.target.value)}>
          <option value="">— pick a trainer —</option>
          {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        {trainers.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: T.danger, marginTop: 6 }}>
            No trainers yet. Add a trainer first.
          </div>
        )}
      </Field>
      <Field label="Capacity">
        <Input type="number" min={1} max={20} value={form.capacity} onChange={e => set('capacity', e.target.value)} />
      </Field>
      <Field label="">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.recurring} onChange={e => set('recurring', e.target.checked)} />
          <span style={{ fontSize: '0.88rem', color: T.text }}>
            Repeat weekly forever (materialises 12 weeks of instances)
          </span>
        </label>
      </Field>
    </Modal>
  );
}
