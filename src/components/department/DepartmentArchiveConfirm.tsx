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

  const submit = async () => {
    setError(null);
    try {
      const dept = await api.archiveDepartment(department.tenantId, department.id);
      if (dept) onArchived(dept);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Archive Department</h2>
      <p>Are you sure you want to archive <strong>{department.name}</strong>? This action cannot be undone.</p>
      <p>Type the department name to confirm: <strong>{department.name}</strong></p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div>
        <button disabled={confirm !== department.name} onClick={submit}>Archive</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  );
}
