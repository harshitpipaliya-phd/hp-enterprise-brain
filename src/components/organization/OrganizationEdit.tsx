import { useState } from 'react';
import type { Organization } from '../../App';
import { api } from '../../api/organization';

interface Props {
  organization: Organization;
  onUpdated: (org: Organization) => void;
  onCancel: () => void;
}

export default function OrganizationEdit({ organization, onUpdated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: organization.name,
    legalName: organization.legalName ?? '',
    orgCode: organization.orgCode,
    industry: organization.industry ?? '',
    country: organization.country ?? '',
    timezone: organization.timezone,
    currency: organization.currency,
    logo: organization.logo ?? '',
    status: organization.status as 'active' | 'inactive' | 'archived',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const org = await api.updateOrganization(organization.tenantId, organization.id, form);
      if (org) onUpdated(org);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Edit Organization</h2>
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
          Status
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
