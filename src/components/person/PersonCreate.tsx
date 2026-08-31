import { useEffect, useState } from 'react';
import { BriefcaseBusiness, Building2, Contact, ShieldCheck, UserRound } from 'lucide-react';
import type { Person } from './PersonApp';
import { api } from '../../api/person';
import { api as departmentApi } from '../../api/department';
import { api as capabilityApi } from '../../api/capability';
import './PersonList.css';

interface Props { tenantId: string; orgId: string; organizationName: string; onCreated: (person: Person) => void; onCancel: () => void; }

export default function PersonCreate({ tenantId, orgId, organizationName, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({ employeeId: '', firstName: '', lastName: '', displayName: '', email: '', phone: '', gender: '', dateOfBirth: '', departmentId: '', designation: '', employmentType: 'full_time', reportingManagerId: '', joiningDate: '', location: '', employmentStatus: 'active', profile: '', skills: [] as string[] });
  const [departments, setDepartments] = useState<any[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [capabilities, setCapabilities] = useState<any[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      departmentApi.listDepartments(tenantId, orgId),
      api.listPeople(tenantId, orgId),
      capabilityApi.listCapabilities(tenantId, orgId),
    ]).then(([departmentRows, personRows, capabilityRows]) => {
      if (cancelled) return;
      setDepartments(departmentRows); setPeople(personRows); setCapabilities(capabilityRows);
    }).catch(() => { if (!cancelled) { setDepartments([]); setPeople([]); setCapabilities([]); } })
      .finally(() => { if (!cancelled) setLoadingReferences(false); });
    return () => { cancelled = true; };
  }, [tenantId, orgId]);

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setSaving(true);
    try {
      const person = await api.createPerson(tenantId, {
        employeeId: form.employeeId.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() || null, gender: form.gender || null,
        departmentId: form.departmentId || null, joiningDate: form.joiningDate || null,
      });
      onCreated(person);
    } catch (e: any) { setError(e.message || 'Unable to create this person.'); } finally { setSaving(false); }
  };

  return <main className="people-create">
    <form className="people-create__layout" onSubmit={submit}>
      <div className="people-create__form">
        <Section icon={<Contact size={18} />} title="Identity and contact" description="Core details used to identify and contact this person.">
          <Field label="Employee ID" required><input required value={form.employeeId} onChange={(e) => update({ employeeId: e.target.value })} placeholder="e.g. EMP-1042" /></Field>
          <Field label="Display name"><input value={form.displayName} onChange={(e) => update({ displayName: e.target.value })} placeholder="Name shown across the workspace" /></Field>
          <Field label="First name" required><input required value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} /></Field>
          <Field label="Last name" required><input required value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} /></Field>
          <Field label="Work email" required><input required type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} /></Field>
          <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => update({ phone: e.target.value })} /></Field>
          <Field label="Gender"><select value={form.gender} onChange={(e) => update({ gender: e.target.value })}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select></Field>
          <Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} /></Field>
        </Section>
        <Section icon={<BriefcaseBusiness size={18} />} title="Employment and reporting" description="Place the person in the organization and establish their working context.">
          <Field label="Department"><select value={form.departmentId} disabled={loadingReferences} onChange={(e) => update({ departmentId: e.target.value })}><option value="">Unassigned</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Role / job title"><input value={form.designation} onChange={(e) => update({ designation: e.target.value })} placeholder="e.g. Operations Manager" /></Field>
          <Field label="Employee type"><select value={form.employmentType} onChange={(e) => update({ employmentType: e.target.value })}><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="intern">Intern</option></select></Field>
          <Field label="Reporting manager"><select value={form.reportingManagerId} disabled={loadingReferences} onChange={(e) => update({ reportingManagerId: e.target.value })}><option value="">No manager assigned</option>{people.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></Field>
          <Field label="Joining date"><input type="date" value={form.joiningDate} onChange={(e) => update({ joiningDate: e.target.value })} /></Field>
          <Field label="Location / site"><input value={form.location} onChange={(e) => update({ location: e.target.value })} placeholder="Office, city, or site" /></Field>
          <Field label="Employment status"><select value={form.employmentStatus} onChange={(e) => update({ employmentStatus: e.target.value })}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></Field>
          <Field label="Profile information"><input value={form.profile} onChange={(e) => update({ profile: e.target.value })} placeholder="Employee profile or notes" /></Field>
        </Section>
        <Section icon={<UserRound size={18} />} title="Skills and capabilities" description="Select the capabilities most relevant to this person’s work.">
          <div className="people-create__capabilities">{capabilities.length === 0 ? <p>No capabilities are available for this organization yet.</p> : capabilities.map((capability) => <label key={capability.id}><input type="checkbox" checked={form.skills.includes(capability.id)} onChange={(e) => update({ skills: e.target.checked ? [...form.skills, capability.id] : form.skills.filter((id) => id !== capability.id) })} />{capability.name}</label>)}</div>
        </Section>
        {error && <div className="people-alert" role="alert">{error}</div>}
        <footer className="people-create__footer"><button type="submit" disabled={saving || !form.employeeId.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}>{saving ? 'Saving…' : 'Save person'}</button><button type="button" className="eb-pill-btn" disabled={saving} onClick={onCancel}>Cancel</button></footer>
      </div>
      <aside className="people-create__aside"><section><Building2 size={18} /><div><h3>Organization-scoped</h3><p>This person is created directly under {organizationName}.</p></div></section><section><ShieldCheck size={18} /><div><h3>Secure creation</h3><p>Identity, active status, creator, and audit timestamps are assigned by the authenticated backend.</p></div></section></aside>
    </form>
  </main>;
}

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) { return <section className="people-create__section"><header><span>{icon}</span><div><h3>{title}</h3><p>{description}</p></div></header><div className="people-create__fields">{children}</div></section>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="people-create__field"><span>{label}{required && <b>Required</b>}</span>{children}</label>; }
