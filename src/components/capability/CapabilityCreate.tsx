import { useState } from 'react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';

interface Props {
  tenantId: string;
  orgId: string;
  onCreated: (cap: Capability) => void;
  onCancel: () => void;
}

const KASBA_FIELDS: Array<[string, string]> = [
  ['knowledge', 'Knowledge'],
  ['ability', 'Ability'],
  ['skill', 'Skill'],
  ['behaviour', 'Behaviour'],
  ['attitude', 'Attitude'],
];

// tenantId is not in the create payload: CapabilityController derives tenant_id
// from the bearer token and would ignore a body-supplied one, per the tenant
// isolation rule in EnsureTenantScope.
export default function CapabilityCreate({ orgId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    capabilityCode: '',
    name: '',
    description: '',
    category: 'general',
    capabilityType: 'competency',
    difficulty: 'intermediate',
    criticality: 'medium',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // CapabilityController::store() validates name / capabilityCode / orgId /
      // description / category, derives tenant_id and created_by from the
      // token, and lets the table defaults supply capabilityType, difficulty
      // and criticality — those three columns are not writable on create.
      const cap = await api.createCapability({
        name: form.name,
        capabilityCode: form.capabilityCode,
        orgId: String(orgId),
        description: form.description || null,
        category: form.category || null,
      });
      onCreated(cap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Create Capability</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <label>Code <input required value={form.capabilityCode} onChange={(e) => setForm({ ...form, capabilityCode: e.target.value })} /></label>
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
        <div>
          <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
      <h3 style={{ marginTop: 24 }}>KASBA Elements</h3>
      {KASBA_FIELDS.map(([key, label]) => (
        <p key={key} style={{ color: '#666' }}>{label}: structured KASBA data is editable after creation.</p>
      ))}
    </div>
  );
}
