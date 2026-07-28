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
  const [archiving, setArchiving] = useState(false);

  const submit = async () => {
    setError(null);
    setArchiving(true);
    try {
      // The endpoint acknowledges with {ok:true} and soft-deletes the row, so
      // there is no archived organization to read back — the caller reloads the
      // list and this one is simply gone from it. Hand back the organization we
      // already have so the confirmation message can name it.
      await api.archiveOrganization(organization.tenantId, organization.id);
      onArchived({ ...organization, status: 'archived' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <h2>Archive Organization</h2>
      <p>Are you sure you want to archive <strong>{organization.name}</strong>? This action cannot be undone.</p>
      <p>Type the organization name to confirm: <strong>{organization.name}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== organization.name || archiving} onClick={submit}>{archiving ? 'Archiving…' : 'Archive'}</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
