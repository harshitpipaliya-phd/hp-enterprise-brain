import { useState } from 'react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';

interface Props {
  person: Person;
  onUpdated: (person: Person) => void;
  onCancel: () => void;
}

/**
 * Edit a person.
 *
 * ONLY THE FOUR FIELDS THE BACKEND WRITES. PersonController::update() validates
 * and maps exactly firstName, lastName, email and phone onto the tenant's Person
 * source; every other key in the request body is discarded by the validator.
 *
 * This form used to render sixteen inputs — Employee ID, Display Name, Gender,
 * Date of Birth, Employment Type, Employment Status, Joining Date, Department
 * ID, Manager ID, Designation, Location, Status — and submit four. The other
 * twelve accepted typing, showed no error, and silently discarded the edit;
 * the submit handler even carried a comment explaining that they are not sent.
 * A control that cannot change anything is worse than an absent one, because it
 * tells the user they have made a change they have not made. They are gone.
 */
export default function PersonEdit({ person, onUpdated, onCancel }: Props) {
  const [form, setForm] = useState({
    firstName: person.firstName ?? '',
    lastName: person.lastName ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updatePerson(person.tenantId, person.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
      });
      onUpdated(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="eb-eyebrow">Edit person</div>
      <h2 style={{ marginTop: 6 }}>{person.displayName || `${person.firstName} ${person.lastName}`}</h2>
      <p style={{ color: 'var(--content-secondary)', fontSize: 13.5, lineHeight: 1.6, maxWidth: '70ch' }}>
        Name and contact details are written back to this organization’s source system. Class, department,
        role and reference number are owned there and are not editable from the Brain.
      </p>

      {error && <div className="people-alert" role="alert" style={{ marginTop: 16 }}>{error}</div>}

      <form onSubmit={submit} style={{ display: 'grid', gap: 14, marginTop: 20 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 650, color: 'var(--content-secondary)' }}>
          First name
          <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 650, color: 'var(--content-secondary)' }}>
          Last name
          <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 650, color: 'var(--content-secondary)' }}>
          Email
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 650, color: 'var(--content-secondary)' }}>
          Phone
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="eb-pill-btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
