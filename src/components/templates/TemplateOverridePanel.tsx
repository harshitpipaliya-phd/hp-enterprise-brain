import { useState } from 'react';
import { api } from '../../api/templateOverrides';

interface TemplateOverridePanelProps {
  orgId: string;
  templateType: string;
}

export default function TemplateOverridePanel({ orgId, templateType }: TemplateOverridePanelProps) {
  const [level, setLevel] = useState<'org' | 'role' | 'user'>('org');
  const [templateKey, setTemplateKey] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body = {
        tenantId: '',
        orgId,
        templateType,
        templateKey,
        level,
        value,
        reason: reason || undefined,
      };
      await api.createTemplateOverride(body);
      setSuccess(true);
      setTemplateKey('');
      setValue('');
      setReason('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ padding: 16, maxWidth: 520, display: 'grid', gap: 12 }}>
      <h3 style={{ marginBottom: 4 }}>Override: {templateType}</h3>
      {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
      {success && <div style={{ color: '#22c55e', fontSize: 13 }}>Override saved.</div>}

      <label style={{ fontSize: 13 }}>
        Level
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'org' | 'role' | 'user')}
          style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', width: '100%', marginTop: 4 }}
        >
          <option value="org">Organization</option>
          <option value="role">Role</option>
          <option value="user">User</option>
        </select>
      </label>

      <label style={{ fontSize: 13 }}>
        Key
        <input
          type="text"
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          required
          placeholder="template.key"
          style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', width: '100%', marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: 13 }}>
        Value
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          placeholder="new value"
          style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', width: '100%', marginTop: 4 }}
        />
      </label>

      <label style={{ fontSize: 13 }}>
        Reason
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="optional"
          style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', width: '100%', marginTop: 4 }}
        />
      </label>

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid #3b82f6',
          backgroundColor: '#3b82f6',
          color: '#fff',
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save Override'}
      </button>
    </form>
  );
}
