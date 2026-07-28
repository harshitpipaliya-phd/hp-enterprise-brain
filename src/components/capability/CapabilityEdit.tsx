import { useState } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  capability: Capability;
  onUpdated: (cap: Capability) => void;
  onCancel: () => void;
}

export default function CapabilityEdit({ capability, onUpdated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: capability.name,
    description: capability.description ?? '',
    category: capability.category,
    capabilityType: capability.capabilityType,
    difficulty: capability.difficulty,
    criticality: capability.criticality,
    status: capability.status as 'active' | 'inactive' | 'archived' | 'draft',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const updated = await api.updateCapability(capability.tenantId, capability.id, {
        ...form,
        description: form.description || null,
      });
      if (updated) onUpdated(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Edit Capability</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <label>Name <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Description <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>Category <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
        <label>Type
          <select value={form.capabilityType} onChange={(e) => setForm({ ...form, capabilityType: e.target.value })}>
            <option value="competency">Competency</option>
            <option value="skill">Skill</option>
            <option value="knowledge">Knowledge</option>
            <option value="behaviour">Behaviour</option>
          </select>
        </label>
        <label>Difficulty
          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </label>
        <label>Criticality
          <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <div>
          <button type="submit">Save</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
