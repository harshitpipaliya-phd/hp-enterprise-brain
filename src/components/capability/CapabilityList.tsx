import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Archive, ArrowRight, Boxes, CircleGauge, Filter, Search, ShieldAlert, Target, UserCheck, Users } from 'lucide-react';
import type { Capability } from './CapabilityApp';
import { api } from '../../api/capability';
import './CapabilityList.css';

interface Props {
  capabilities: Capability[];
  loading: boolean;
  onSelect: (cap: Capability) => void;
  onEdit: (cap: Capability) => void;
  onArchive: (cap: Capability) => void;
  onAssign: (cap: Capability) => void;
  tenantId: string;
}

export default function CapabilityList({
  capabilities,
  loading,
  onSelect,
  onEdit,
  onArchive,
  onAssign,
  tenantId,
}: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Capability[] | null>(null);
  const [type, setType] = useState('all');
  const [criticality, setCriticality] = useState('all');
  const [coverage, setCoverage] = useState('all');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  /**
   * How many people, departments or roles hold each capability.
   *
   * WHY THIS IS HERE AT ALL. This screen listed the capability registry and
   * nothing else — name, code, category, difficulty, version. Every one of those
   * is a property of the definition, so the page answered "what capabilities
   * have been written down" and never "does anyone actually have them", which is
   * the only question a capability register exists to answer. The assignment
   * endpoint was already there and unused by any screen.
   *
   * One request per capability, settled independently: a capability whose
   * assignments fail to load shows as unknown rather than taking the page down,
   * and the registry itself renders before any of them return.
   */
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({});
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  useEffect(() => {
    if (capabilities.length === 0) {
      setAssignmentCounts({});
      setAssignmentsLoaded(true);
      return;
    }

    let cancelled = false;
    setAssignmentsLoaded(false);

    Promise.allSettled(capabilities.map((cap) => api.getAssignments(tenantId, cap.id)))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            next[capabilities[index].id] = result.value.length;
          }
        });
        setAssignmentCounts(next);
        setAssignmentsLoaded(true);
      });

    return () => { cancelled = true; };
  }, [capabilities, tenantId]);

  const doSearch = async () => {
    if (!search.trim()) {
      setResults(null);
      return;
    }

    setSearching(true);
    setSearchError(null);

    try {
      const data = await api.searchCapabilities(tenantId, search);
      setResults(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Unknown error');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const assignmentsFor = (cap: Capability): number | null => assignmentCounts[cap.id] ?? null;

  const visible = useMemo(
    () =>
      (results ?? capabilities).filter((cap) => {
        if (type !== 'all' && cap.capabilityType !== type) return false;
        if (criticality !== 'all' && cap.criticality !== criticality) return false;
        const assigned = assignmentCounts[cap.id] ?? 0;
        if (coverage === 'assigned' && assigned === 0) return false;
        if (coverage === 'unassigned' && assigned > 0) return false;
        return true;
      }),
    [results, capabilities, type, criticality, coverage, assignmentCounts],
  );

  const active = capabilities.filter((cap) => cap.status === 'active').length;
  const critical = capabilities.filter((cap) => cap.criticality === 'critical' || cap.criticality === 'high').length;
  const assignedCount = capabilities.filter((cap) => (assignmentCounts[cap.id] ?? 0) > 0).length;
  const unassignedCritical = capabilities.filter(
    (cap) => (cap.criticality === 'critical' || cap.criticality === 'high') && (assignmentCounts[cap.id] ?? 0) === 0,
  ).length;
  const totalAssignments = Object.values(assignmentCounts).reduce((sum, n) => sum + n, 0);

  if (!loading && capabilities.length === 0) {
    return (
      <div className="cap-library">
        <div className="cap-library__blank">
          <Target size={28} />
          <strong>No capabilities have been defined for this organization yet</strong>
          <p>
            A capability is something the organization needs its people to be able to do. Once one is defined,
            you can assign it to a person, a department or a role, and this screen will show which of them are
            covered and which are not.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cap-library">
      <section className="cap-library__kpis">
        <Kpi icon={<Boxes />} label="Capabilities defined" value={capabilities.length} hint={`${active} active`} />
        <Kpi
          icon={<UserCheck />}
          label="Assigned to someone"
          value={assignmentsLoaded ? assignedCount : '—'}
          hint={assignmentsLoaded ? `${Math.max(0, capabilities.length - assignedCount)} nobody is assigned to` : 'Loading assignments…'}
          danger={assignmentsLoaded && assignedCount === 0}
        />
        <Kpi icon={<ShieldAlert />} label="High criticality" value={critical} hint="Critical or high priority" />
        <Kpi
          icon={<Users />}
          label="Critical and uncovered"
          value={assignmentsLoaded ? unassignedCritical : '—'}
          hint={assignmentsLoaded && unassignedCritical > 0 ? 'Nobody holds these' : 'Every critical capability is covered'}
          danger={assignmentsLoaded && unassignedCritical > 0}
        />
        <Kpi icon={<CircleGauge />} label="Assignments in total" value={assignmentsLoaded ? totalAssignments : '—'} hint="People, departments and roles" />
      </section>

      {/*
        The one thing this screen must not do is imply coverage it cannot see.
        When the assignment table is empty for this tenant, say so once, plainly,
        rather than letting every card read "0 assigned" — which looks like a
        measurement of a gap rather than an absence of records.
      */}
      {assignmentsLoaded && totalAssignments === 0 && (
        <p className="cap-library__notice">
          No capability has been assigned to anyone yet. Assignments record which people, departments or roles
          hold a capability; until they exist, coverage and gaps cannot be reported. Use <strong>Assign</strong> on
          any capability below to record the first one.
        </p>
      )}

      <section className="cap-library__workspace">
        <div className="cap-library__toolbar">
          <div className="cap-library__search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setResults(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doSearch();
              }}
              placeholder="Search capability name or code"
            />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            <option value="competency">Competency</option>
            <option value="skill">Skill</option>
            <option value="knowledge">Knowledge</option>
            <option value="behaviour">Behaviour</option>
          </select>
          <select value={criticality} onChange={(e) => setCriticality(e.target.value)} aria-label="Criticality filter">
            <option value="all">All criticality</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={coverage} onChange={(e) => setCoverage(e.target.value)} aria-label="Coverage filter">
            <option value="all">Assigned and unassigned</option>
            <option value="assigned">Someone is assigned</option>
            <option value="unassigned">Nobody is assigned</option>
          </select>
          <button type="button" onClick={doSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          <button
            type="button"
            className="eb-pill-btn"
            onClick={() => {
              setSearch('');
              setResults(null);
              setType('all');
              setCriticality('all');
              setCoverage('all');
              setSearchError(null);
            }}
          >
            Reset
          </button>
        </div>

        {searchError && <p className="cap-library__error">{searchError}</p>}

        <div className="cap-library__head">
          <div>
            <span><Filter size={14} /> Capability registry</span>
            <h3>{visible.length} {visible.length === 1 ? 'capability' : 'capabilities'}</h3>
          </div>
        </div>

        {loading ? (
          <div className="cap-library__empty">Loading capabilities...</div>
        ) : visible.length === 0 ? (
          <div className="cap-library__empty">No capabilities match the current filters.</div>
        ) : (
          <div className="cap-library__grid">
            {visible.map((cap) => (
              <article key={cap.id} className="cap-card">
                <div className="cap-card__top">
                  <span className="cap-card__code">{cap.capabilityCode || 'Uncoded'}</span>
                  <span className={`cap-card__criticality cap-card__criticality--${cap.criticality || 'medium'}`}>
                    {cap.criticality || 'medium'}
                  </span>
                </div>
                <button className="cap-card__title" onClick={() => onSelect(cap)}>
                  <h3>{cap.name}</h3>
                  <ArrowRight size={17} />
                </button>
                <p>{cap.description || 'No description has been recorded for this capability.'}</p>
                <div className="cap-card__meta">
                  {cap.category && <span>{cap.category}</span>}
                  {cap.capabilityType && <span>{cap.capabilityType}</span>}
                  {cap.difficulty && <span>{cap.difficulty}</span>}
                </div>
                <footer>
                  {/* Who holds it — the fact the register exists to record. */}
                  <span className="cap-card__coverage" data-covered={(assignmentsFor(cap) ?? 0) > 0 ? 'true' : 'false'}>
                    {!assignmentsLoaded
                      ? 'Checking assignments…'
                      : (assignmentsFor(cap) ?? 0) > 0
                        ? `Assigned to ${assignmentsFor(cap)}`
                        : 'Nobody assigned'}
                  </span>
                  <span className="cap-card__status">{cap.status || 'active'}</span>
                </footer>
                <div className="cap-card__actions">
                  <button className="eb-pill-btn" onClick={() => onEdit(cap)}>Edit</button>
                  <button className="eb-pill-btn" onClick={() => onAssign(cap)}>Assign</button>
                  <button className="cap-card__archive" onClick={() => onArchive(cap)} aria-label={`Archive ${cap.name}`}>
                    <Archive size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, hint, danger }: { icon: ReactNode; label: string; value: number | string; hint: string; danger?: boolean }) {
  return (
    <article className="cap-kpi" data-danger={danger ? 'true' : undefined}>
      <span>{icon}</span>
      <em>{label}</em>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
      <small>{hint}</small>
    </article>
  );
}
