import { useState } from 'react';
import type { Department } from './DepartmentApp';
import { api } from '../../api/department';

interface Props {
  department: Department;
  onUpdated: (dept: Department) => void;
  onCancel: () => void;
}

export default function DepartmentEdit({ department, onUpdated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: department.name,
    description: department.description ?? '',
    departmentType: department.departmentType as 'department' | 'division' | 'unit' | 'team',
    parentDepartmentId: department.parentDepartmentId ?? '',
    headId: department.headId ?? '',
    orgId: department.orgId,
    status: department.status as 'active' | 'inactive' | 'archived',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const dept = await api.updateDepartment(department.tenantId, department.id, {
        ...form,
        parentDepartmentId: form.parentDepartmentId || null,
        headId: form.headId || null,
      });
      if (dept) onUpdated(dept);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Edit Department</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <label>
          Name <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Description <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label>
          Type
          <select value={form.departmentType} onChange={(e) => setForm({ ...form, departmentType: e.target.value as any })}>
            <option value="department">Department</option>
            <option value="division">Division</option>
            <option value="unit">Unit</option>
            <option value="team">Team</option>
          </select>
        </label>
        <label>
          Parent Department ID <input value={form.parentDepartmentId} onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })} />
        </label>
        <label>
          Head ID <input value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })} />
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
