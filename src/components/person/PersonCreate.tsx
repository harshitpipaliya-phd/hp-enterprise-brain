import { useState } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';

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
    createdBy: 'current-user',
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const person = await api.createPerson({
        ...form,
        tenantId,
        orgId,
        displayName: form.displayName || null,
        phone: form.phone || null,
        profilePhoto: form.profilePhoto || null,
        gender: form.gender || null,
        dateOfBirth: form.dateOfBirth || null,
        joiningDate: form.joiningDate || null,
        departmentId: form.departmentId || null,
        managerId: form.managerId || null,
        designation: form.designation || null,
        location: form.location || null,
        reportingManagerId: form.reportingManagerId || null,
      });
      onCreated(person);
    } catch (e: any) {
      setError(e.message);
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
          Department ID <input value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
        </label>
        <label>
          Manager ID <input value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })} />
        </label>
        <label>
          Designation <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </label>
        <label>
          Location <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
        <div>
          <button type="submit">Create</button>
          <button type="button" onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
