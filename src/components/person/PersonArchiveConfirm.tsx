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
  const [archiving, setArchiving] = useState(false);

  const submit = async () => {
    setError(null);
    setArchiving(true);
    try {
      // Acknowledges with {ok:true} and soft-deletes; the archived person is
      // then excluded from every read, so the caller reloads the list.
      await api.archivePerson(person.tenantId, person.id);
      onArchived({ ...person, status: 'archived' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <h2>Archive Person</h2>
      <p>Are you sure you want to archive <strong>{person.displayName || `${person.firstName} ${person.lastName}`}</strong>? This action cannot be undone.</p>
      <p>Type the person name to confirm: <strong>{person.displayName || `${person.firstName} ${person.lastName}`}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== (person.displayName || `${person.firstName} ${person.lastName}`) || archiving} onClick={submit}>{archiving ? 'Archiving…' : 'Archive'}</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
