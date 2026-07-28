import { useState } from 'react';
import type { Organization } from '../../App';
import { api } from '../../api/organization';

interface Props {
  organization: Organization;
  onArchived: (org: Organization) => void;
  onCancel: () => void;
}

export default function OrganizationArchiveConfirm({ organization, onArchived, onCancel }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const org = await api.archiveOrganization(organization.tenantId, organization.id);
      if (org) onArchived(org);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Archive Organization</h2>
      <p>Are you sure you want to archive <strong>{organization.name}</strong>? This action cannot be undone.</p>
      <p>Type the organization name to confirm: <strong>{organization.name}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== organization.name} onClick={submit}>Archive</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
