import { useState, useEffect } from 'react';
import type { Department } from './DepartmentApp';
import { api } from '../../api/department';

interface Props {
  tenantId: string;
  orgId: string;
  onCreated: (dept: Department) => void;
  onCancel: () => void;
}

export default function DepartmentCreate({ tenantId, orgId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    departmentType: 'department' as 'department' | 'division' | 'unit' | 'team',
    parentDepartmentId: '',
  });
  const [parents, setParents] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The parent department has to be an id that exists in this organization, so
  // the choices come from the same endpoint the list screen reads rather than
  // from a free-text box the user has to guess an integer into.
  useEffect(() => {
    api.listDepartments(tenantId, orgId).then(setParents).catch(() => setParents([]));
  }, [tenantId, orgId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // DepartmentController::store() validates name, description, parentId and
      // orgId, and takes created_by from the token. `parentId` is the field
      // name it expects — sending parentDepartmentId meant the chosen parent
      // was silently discarded on every create. departmentType and headId have
      // no columns in hrms_departments.
      const dept = await api.createDepartment(tenantId, {
        name: form.name,
        description: form.description || null,
        parentId: form.parentDepartmentId ? Number(form.parentDepartmentId) : null,
        orgId: Number(orgId),
      });
      onCreated(dept);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Create Department</h2>
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
        <div>
          <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
