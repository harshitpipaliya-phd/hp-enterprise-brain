import { useState } from 'react';
import type { Department } from './DepartmentApp';
import { api } from '../../api/department';

interface Props {
  department: Department;
  onArchived: (dept: Department) => void;
  onCancel: () => void;
}

export default function DepartmentArchiveConfirm({ department, onArchived, onCancel }: Props) {
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const submit = async () => {
    setError(null);
    setArchiving(true);
    try {
      // The endpoint acknowledges with {ok:true} and soft-deletes the row, so
      // there is nothing to read back. Passing that ack on as if it were a
      // department left the caller with an object that had no id and dropped
      // the archived row out of the list by accident rather than by reload.
      await api.archiveDepartment(department.tenantId, department.id);
      onArchived({ ...department, status: 'archived' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <h2>Archive Department</h2>
      <p>Are you sure you want to archive <strong>{department.name}</strong>? This action cannot be undone.</p>
      <p>Type the department name to confirm: <strong>{department.name}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== department.name || archiving} onClick={submit}>{archiving ? 'Archiving…' : 'Archive'}</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
