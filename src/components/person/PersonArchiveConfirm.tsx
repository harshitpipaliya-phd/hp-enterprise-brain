import { useState } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';

interface Props {
  person: Person;
  onArchived: (person: Person) => void;
  onCancel: () => void;
}

export default function PersonArchiveConfirm({ person, onArchived, onCancel }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const p = await api.archivePerson(person.tenantId, person.id);
      if (p) onArchived(p);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Archive Person</h2>
      <p>Are you sure you want to archive <strong>{person.displayName || `${person.firstName} ${person.lastName}`}</strong>? This action cannot be undone.</p>
      <p>Type the person name to confirm: <strong>{person.displayName || `${person.firstName} ${person.lastName}`}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== (person.displayName || `${person.firstName} ${person.lastName}`)} onClick={submit}>Archive</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
