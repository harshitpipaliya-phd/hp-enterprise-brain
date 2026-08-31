import { useEffect, useState } from 'react';
import { Building2, FolderTree, Info, ShieldCheck } from 'lucide-react';
import type { Department } from './DepartmentApp';
import { api } from '../../api/department';
import './DepartmentList.css';

interface Props {
  tenantId: string;
  orgId: string;
  organizationName: string;
  onCreated: (dept: Department) => void;
  onCancel: () => void;
}

/**
 * A department is ERP-owned master data. The connected source supports its
 * identity, purpose and hierarchy; ownership, status, actor and timestamps are
 * assigned by the authenticated backend and are shown here as such.
 */
export default function DepartmentCreate({ tenantId, orgId, organizationName, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({ name: '', description: '', parentDepartmentId: '' });
  const [parents, setParents] = useState<Department[]>([]);
  const [parentsLoading, setParentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setParentsLoading(true);
    api.listDepartments(tenantId, orgId)
      .then((departments) => { if (!cancelled) setParents(departments); })
      .catch(() => { if (!cancelled) setParents([]); })
      .finally(() => { if (!cancelled) setParentsLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, orgId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const department = await api.createDepartment(tenantId, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        parentId: form.parentDepartmentId ? Number(form.parentDepartmentId) : null,
      });
      onCreated(department);
    } catch (e: any) {
      setError(e.message || 'Unable to create the department.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="dept-create">
      <div className="dept-create__layout">
        <form className="dept-create__form" onSubmit={submit}>
          <section className="dept-create__card">
            <div className="dept-create__card-head">
              <span className="dept-create__icon"><Building2 size={18} /></span>
              <div><h3>Department identity</h3><p>Give this unit a name and a purpose people can recognize.</p></div>
            </div>
            <div className="dept-create__fields">
              <label className="dept-create__field dept-create__field--wide">
                <span>Department name <b>Required</b></span>
                <input autoFocus required maxLength={255} placeholder="e.g. Customer Operations" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                <small>Use the name people use in the organization.</small>
              </label>
              <label className="dept-create__field dept-create__field--wide">
                <span>Purpose and responsibilities</span>
                <textarea rows={5} placeholder="Describe the department’s remit, services, or primary responsibilities." value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                <small>This helps colleagues understand the unit’s role in the organization.</small>
              </label>
            </div>
          </section>

          <section className="dept-create__card">
            <div className="dept-create__card-head">
              <span className="dept-create__icon"><FolderTree size={18} /></span>
              <div><h3>Structure and ownership</h3><p>Place the department correctly and confirm where it will be created.</p></div>
            </div>
            <div className="dept-create__fields">
              <label className="dept-create__field">
                <span>Parent department</span>
                <select value={form.parentDepartmentId} onChange={(event) => setForm({ ...form, parentDepartmentId: event.target.value })} disabled={parentsLoading}>
                  <option value="">Top-level department</option>
                  {parents.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <small>{parentsLoading ? 'Loading eligible departments…' : 'Choose a parent only when this is a sub-unit.'}</small>
              </label>
              <div className="dept-create__field">
                <span>Organization</span>
                <div className="dept-create__readonly">{organizationName}</div>
                <small>Assigned from your authenticated organization.</small>
              </div>
              <div className="dept-create__field">
                <span>Initial status</span>
                <div className="dept-create__readonly"><span className="dept-intel__badge dept-intel__badge--good">Active</span></div>
                <small>New departments are active when created.</small>
              </div>
            </div>
          </section>

          {error && <div className="dept-create__error" role="alert">{error}</div>}
          <footer className="dept-create__footer">
            <button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create department'}</button>
            <button type="button" className="dept-intel__ghost" disabled={saving} onClick={onCancel}>Cancel</button>
          </footer>
        </form>

        <aside className="dept-create__aside" aria-label="Department creation guidance">
          <section><Info size={18} /><div><h3>Before you create</h3><p>Check for an existing department first to avoid duplicate organizational units.</p></div></section>
          <section><ShieldCheck size={18} /><div><h3>Reliable by design</h3><p>Organization ownership, creator, status, and audit timestamps are assigned by the backend.</p></div></section>
        </aside>
      </div>
    </main>
  );
}
