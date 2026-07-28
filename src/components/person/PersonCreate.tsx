import { useState, useEffect } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';
import { api as departmentApi } from '../../api/department';

interface Props {
  tenantId: string;
  orgId: string;
  onCreated: (person: Person) => void;
  onCancel: () => void;
}

export default function PersonCreate({ tenantId, orgId, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
    phone: '',
    profilePhoto: '',
    gender: '',
    dateOfBirth: '',
    employmentType: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'intern',
    employmentStatus: 'active' as 'active' | 'on_leave' | 'terminated' | 'resigned',
    joiningDate: '',
    departmentId: '',
    managerId: '',
    designation: '',
    location: '',
    reportingManagerId: '',
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Department is an ERP id, so the options come from the departments endpoint
  // for this organization rather than from a number typed by hand.
  useEffect(() => {
    departmentApi.listDepartments(tenantId, orgId).then(setDepartments).catch(() => setDepartments([]));
  }, [tenantId, orgId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // PersonController::store() validates exactly these seven fields and
      // writes tbluser. The rest of this form — displayName, employmentType,
      // joiningDate, designation, location, manager — has no column in tbluser
      // and is not sent; created_by comes from the bearer token.
      const person = await api.createPerson(tenantId, {
        employeeId: form.employeeId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        orgId: Number(orgId),
        phone: form.phone || null,
        gender: form.gender || null,
      });
      onCreated(person);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>Create Person</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 600 }}>
        <label>
          Employee ID <input required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
        </label>
        <label>
          First Name <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        <label>
          Last Name <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label>
          Display Name <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </label>
        <label>
          Email <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Phone <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label>
          Gender <input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        </label>
        <label>
          Date of Birth <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
        </label>
        <label>
          Employment Type
          <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as any })}>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </label>
        <label>
          Joining Date <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
        </label>
        <label>
          Department
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">Unassigned</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          Designation <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </label>
        <label>
          Location <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
        <div>
          <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
