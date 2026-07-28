import { useState, useEffect } from 'react';
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
    status: department.status as 'active' | 'inactive' | 'archived',
  });
  const [parents, setParents] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Real candidate parents from the same organization, minus this department
  // (a department cannot be its own parent).
  useEffect(() => {
    api
      .listDepartments(department.tenantId, department.orgId)
      .then((rows) => setParents(rows.filter((d: Department) => d.id !== department.id)))
      .catch(() => setParents([]));
  }, [department.tenantId, department.orgId, department.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // DepartmentController::update() maps exactly name / description /
      // parentId onto hrms_departments columns. departmentType, headId and
      // status have no writable column, so they are not sent rather than being
      // posted and dropped by validate().
      const dept = await api.updateDepartment(department.tenantId, department.id, {
        name: form.name,
        description: form.description || null,
        parentId: form.parentDepartmentId ? Number(form.parentDepartmentId) : null,
      });
      onUpdated(dept);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
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
          Parent Department
          <select value={form.parentDepartmentId} onChange={(e) => setForm({ ...form, parentDepartmentId: e.target.value })}>
            <option value="">None (top level)</option>
            {parents.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
