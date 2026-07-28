import { useState } from 'react';
import type { Organization } from '../../App';
import { api } from '../../api/organization';

interface Props {
  tenantId: string;
  onCreated: (org: Organization) => void;
  onCancel: () => void;
}

export default function OrganizationCreate({ tenantId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    orgCode: '',
    industry: '',
    country: '',
    timezone: 'UTC',
    currency: 'USD',
    logo: '',
    createdBy: 'current-user',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const org = await api.createOrganization({ ...form, tenantId });
      onCreated(org);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Create Organization</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <label>
          Name <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Legal Name <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </label>
        <label>
          Org Code <input required value={form.orgCode} onChange={(e) => setForm({ ...form, orgCode: e.target.value })} />
        </label>
        <label>
          Industry <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
        </label>
        <label>
          Country <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </label>
        <label>
          Timezone <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </label>
        <label>
          Currency <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </label>
        <label>
          Logo URL <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} />
        </label>
        <div>
          <button type="submit">Create</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
