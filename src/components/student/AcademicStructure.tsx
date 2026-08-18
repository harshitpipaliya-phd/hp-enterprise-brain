import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { api } from '../../api/student';
import type { AcademicStructure as Structure } from '../../api/student';
import './StudentList.css';

/**
 * Academic structure — what a school without HR departments is organised by.
 *
 * WHY THIS SCREEN EXISTS. Lions' Departments page said "No departments are
 * recorded for this organization", which was true and useless: the ERP's
 * department table genuinely has no Lions rows, and inventing some to fill the
 * page would have published fabricated units under a real organization's name.
 *
 * The school IS structured, just not by department. Its marks export is
 * organised by standard, academic year, subject and exam; its fee register adds
 * division, batch and quota. Those are the real dimensions, each shown with the
 * record and student counts actually behind it, and the page says in its own
 * words that they are dataset dimensions rather than HR departments — so nobody
 * reads a subject as a business unit.
 *
 * ORGANIZATIONS THAT DO HAVE DEPARTMENTS NEVER SEE THIS. DepartmentApp renders
 * it only when the department list comes back empty AND the tenant has a
 * dataset. Sunrise's departments are untouched.
 */
export default function AcademicStructure({ tenantId }: { tenantId: string }) {
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getStructure(tenantId)
      .then((data) => { if (!cancelled) { setStructure(data); setError(null); } })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? 'Could not load the academic structure.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="structure">
        <div className="structure-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="structure-card" key={i}><header><div className="students-skeleton" style={{ height: 44 }} /></header></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <div className="students-alert" role="alert">{error}</div>;

  const dimensions = structure?.dimensions ?? [];

  if (dimensions.length === 0) {
    return (
      <div className="structure">
        <div className="structure-note">
          <strong>No academic structure is recorded for this organization</strong>
          <p>
            This organization has no HR departments and no imported dataset to derive an academic structure from.
            Import a dataset through the Ingestion Engine, then rebuild the student projection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="structure">
      <div className="structure-note">
        <strong>{structure?.title ?? 'Academic structure'}</strong>
        <p>{structure?.summary}</p>
        <p>
          <Layers size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} aria-hidden="true" />
          Derived by SQL aggregation over this organization&apos;s imported records
          {structure?.datasets?.academic && <> (<code>{structure.datasets.academic}</code></>}
          {structure?.datasets?.fees && <>, <code>{structure.datasets.fees}</code></>}
          {structure?.datasets?.academic && <>)</>}. Nothing on this page is invented or inferred.
        </p>
      </div>

      <div className="structure-grid">
        {dimensions.map((dimension) => (
          <section className="structure-card" key={dimension.key}>
            <header>
              <h3>{dimension.label}</h3>
              <p>{dimension.description}</p>
              <span>{dimension.values.length.toLocaleString()} distinct value{dimension.values.length === 1 ? '' : 's'}</span>
            </header>
            <div className="structure-values">
              {dimension.values.map((value) => (
                <div className="structure-value" key={`${dimension.key}-${value.label}`}>
                  <b>{value.label}</b>
                  <small>
                    {value.students > 0 && <>{value.students.toLocaleString()} student{value.students === 1 ? '' : 's'}</>}
                    {value.students > 0 && value.records > 0 && ' · '}
                    {value.records > 0 && <>{value.records.toLocaleString()} record{value.records === 1 ? '' : 's'}</>}
                  </small>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
