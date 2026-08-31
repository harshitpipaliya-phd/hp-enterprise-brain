import { useMemo } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, Boxes,
  ClipboardList, FileSearch, Gauge, Lightbulb, ListChecks, Target, TrendingUp, Users,
} from 'lucide-react';
import type { DepartmentProfile, ProfileDimension } from '../../api/department';

/**
 * THE DEPARTMENT DASHBOARD.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE HERE IS THE SERVER'S
 *
 * This component computes nothing. The score, the ranks, the narrative and the
 * recommended action all arrive derived, because they are derived from tenant-
 * wide aggregates — a rank is meaningless without the peers, and a browser that
 * recomputed one would need every department's metrics to do it. The client's
 * only job is to decide how a number LOOKS, never what it is.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * "NOT MEASURABLE" IS A FIRST-CLASS STATE, NOT A ZERO
 *
 * A metric the organization cannot record renders as the reason it cannot,
 * never as 0 or "—" alone. The two are opposite findings: a department with no
 * open work and a department whose work is not recorded look identical as a
 * zero, and only one of them is good news.
 */
export function DepartmentProfileView({
  profile,
  onOpenPeople,
  onOpenActivity,
  onOpenSignals,
}: {
  profile: DepartmentProfile;
  onOpenPeople?: () => void;
  onOpenActivity?: () => void;
  onOpenSignals?: () => void;
}) {
  const targets: Record<string, (() => void) | undefined> = {
    people: onOpenPeople,
    activity: onOpenActivity,
    signals: onOpenSignals,
  };

  return (
    <div className="dp">
      <DepartmentPulse profile={profile} onOpenPeople={onOpenPeople} onOpenActivity={onOpenActivity} />

      <div className="dp-grid dp-grid--2">
        <PerformancePanel profile={profile} />
        <WorkloadPanel profile={profile} onOpenActivity={onOpenActivity} />
      </div>

      <div className="dp-grid dp-grid--2">
        <TrendPanel profile={profile} />
        <ContributionPanel profile={profile} />
      </div>

      <IntelligenceBreakdown profile={profile} />

      <div className="dp-grid dp-grid--3">
        <SignalPanel profile={profile} onOpenSignals={onOpenSignals} />
        <EvidencePanel profile={profile} />
        <CasePanel profile={profile} />
      </div>

      <div className="dp-grid dp-grid--2">
        <PeoplePanel profile={profile} onOpenPeople={onOpenPeople} />
        <HealthPanel profile={profile} />
      </div>

      <NarrativePanel profile={profile} />
      <NextActionPanel profile={profile} run={targets[profile.nextAction.target]} />
    </div>
  );
}

/* ========================================================================== */
/*  FORMATTING                                                                */
/* ========================================================================== */

const count = (n: number | null | undefined) => (n === null || n === undefined ? null : n.toLocaleString());
const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? null : `${(v * 100).toFixed(digits)}%`);

/** A value, or the sentence explaining why there is none. Never a bare zero. */
function Figure({ value, reason, suffix }: { value: string | null; reason?: string | null; suffix?: string }) {
  if (value === null) {
    return (
      <>
        <strong className="dp-kpi__value dp-kpi__value--empty">Not measurable</strong>
        {reason && <span className="dp-kpi__hint">{reason}</span>}
      </>
    );
  }

  return (
    <>
      <strong className="dp-kpi__value">{value}{suffix && <small>{suffix}</small>}</strong>
      {reason && <span className="dp-kpi__hint">{reason}</span>}
    </>
  );
}

/* ========================================================================== */
/*  PULSE                                                                     */
/* ========================================================================== */

function DepartmentPulse({ profile, onOpenPeople, onOpenActivity }: {
  profile: DepartmentProfile;
  onOpenPeople?: () => void;
  onOpenActivity?: () => void;
}) {
  const icons: Record<string, JSX.Element> = {
    people: <Users size={15} />,
    activity: <Activity size={15} />,
    backlog: <ListChecks size={15} />,
    completion: <BadgeCheck size={15} />,
    perPerson: <Gauge size={15} />,
    score: <Target size={15} />,
  };

  const render = (format: string, value: number | null) => {
    if (value === null) return null;
    if (format === 'rate') return pct(value);
    if (format === 'decimal') return value.toFixed(1);
    if (format === 'score') return String(value);
    return count(value);
  };

  return (
    <section className="dp-pulse" aria-label="Department pulse">
      {profile.pulse.map((k) => {
        const shown = render(k.format, k.value);
        const click = k.key === 'people' ? onOpenPeople : k.key === 'activity' || k.key === 'backlog' ? onOpenActivity : undefined;

        return (
          <article
            key={k.key}
            className={`dp-kpi${click && shown !== null ? ' dp-kpi--link' : ''}`}
            onClick={click && shown !== null ? click : undefined}
            role={click && shown !== null ? 'button' : undefined}
            tabIndex={click && shown !== null ? 0 : undefined}
            onKeyDown={click && shown !== null ? (e) => { if (e.key === 'Enter') click(); } : undefined}
          >
            <span className="dp-kpi__label">{icons[k.key]}{k.label}</span>
            <Figure value={shown} reason={shown === null ? k.reason : null} suffix={k.format === 'score' ? '/100' : undefined} />
          </article>
        );
      })}
    </section>
  );
}

/* ========================================================================== */
/*  PERFORMANCE                                                               */
/* ========================================================================== */

function PerformancePanel({ profile }: { profile: DepartmentProfile }) {
  const p = profile.performance;

  if (!p.supported) {
    return (
      <section className="dp-card" aria-label="Department performance">
        <h2>Performance</h2>
        <p className="dp-empty">{p.reason}</p>
      </section>
    );
  }

  const rows = [
    { label: 'Completed', value: count(p.completed), tone: 'good' },
    { label: 'Open', value: count(p.backlog), tone: 'warn' },
    { label: 'Cancelled', value: count(p.cancelled), tone: 'crit' },
    { label: 'Classified', value: count(p.classified), tone: 'state' },
  ];

  return (
    <section className="dp-card" aria-label="Department performance">
      <h2>Performance</h2>

      <div className="dp-rate">
        <div className="dp-rate__head">
          <span>Completion rate</span>
          <strong>{pct(p.completionRate) ?? 'Not measurable'}</strong>
        </div>
        <div className="dp-bar" role="img" aria-label={`Completion ${pct(p.completionRate) ?? 'not measurable'}`}>
          <i style={{ width: p.completionRate === null ? '0%' : `${Math.max(2, p.completionRate * 100)}%` }} />
        </div>
        {p.completionRate === null && (
          <p className="dp-note">Fewer classified records than the floor a published rate requires.</p>
        )}
      </div>

      <dl className="dp-facts">
        {rows.map((r) => (
          <div key={r.label} data-tone={r.tone}>
            <dt>{r.label}</dt>
            <dd>{r.value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      <dl className="dp-facts dp-facts--wide">
        <div>
          <dt>Records per person</dt>
          <dd>{p.perPerson === null ? 'Not measurable' : p.perPerson.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Average turnaround</dt>
          <dd>
            {p.turnaroundHours === null
              ? 'Not measurable'
              : `${p.turnaroundHours.toFixed(1)} h`}
          </dd>
        </div>
      </dl>
      {p.turnaroundHours !== null && (
        <p className="dp-note">Measured over {count(p.turnaroundMeasured)} records carrying both an opened and a closed timestamp.</p>
      )}
    </section>
  );
}

/* ========================================================================== */
/*  WORKLOAD                                                                  */
/* ========================================================================== */

function WorkloadPanel({ profile, onOpenActivity }: { profile: DepartmentProfile; onOpenActivity?: () => void }) {
  const w = profile.workload;

  if (!w.supported) {
    return (
      <section className="dp-card" aria-label="Workload">
        <h2>Workload</h2>
        <p className="dp-empty">{w.reason}</p>
        {profile.unclaimedWork && (
          <p className="dp-note">
            {count(profile.unclaimedWork.records)} records are booked against <strong>{profile.unclaimedWork.label}</strong>,
            a separate row on this register.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="dp-card" aria-label="Workload">
      <h2>Workload</h2>

      <div className="dp-stack" role="img" aria-label="Workload distribution">
        {w.segments.map((s) => (
          <i key={s.key} data-seg={s.key} style={{ width: `${Math.max(1, s.share * 100)}%` }} title={`${s.label} ${pct(s.share)}`} />
        ))}
      </div>

      <ul className="dp-legend">
        {w.segments.map((s) => (
          <li key={s.key}>
            <span className="dp-legend__swatch" data-seg={s.key} />
            <span className="dp-legend__label">{s.label}</span>
            <strong>{count(s.count)}</strong>
            <small>{pct(s.share)}</small>
          </li>
        ))}
      </ul>

      <dl className="dp-facts dp-facts--wide">
        <div>
          <dt>Total workload</dt>
          <dd>{count(w.total)}</dd>
        </div>
        <div>
          <dt>Per person</dt>
          <dd>{w.perPerson === null ? 'Not measurable' : w.perPerson.toFixed(1)}</dd>
        </div>
      </dl>

      {onOpenActivity && (
        <button type="button" className="dp-link" onClick={onOpenActivity}>View the records →</button>
      )}
    </section>
  );
}

/* ========================================================================== */
/*  TREND                                                                     */
/* ========================================================================== */

function TrendPanel({ profile }: { profile: DepartmentProfile }) {
  const t = profile.trend;

  const points = useMemo(() => {
    if (!t.supported || t.series.length === 0) return null;

    const values = t.series.map((p) => p.records);
    const max = Math.max(...values, 1);

    return t.series.map((p, i) => ({
      ...p,
      height: Math.max(2, (p.records / max) * 100),
      key: `${p.period}-${i}`,
    }));
  }, [t]);

  if (!points) {
    return (
      <section className="dp-card" aria-label="Activity trend">
        <h2>Activity over time</h2>
        <p className="dp-empty">{t.reason}</p>
      </section>
    );
  }

  const change = t.momentum?.changePercent ?? null;

  return (
    <section className="dp-card" aria-label="Activity trend">
      <div className="dp-card__head">
        <h2>Activity over time</h2>
        {change !== null && (
          <span className={`dp-delta${change >= 0 ? ' dp-delta--up' : ' dp-delta--down'}`}>
            {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Bars rather than a line: the series is monthly buckets, and a line
          between two months implies values that were never measured. */}
      <div className="dp-chart" role="img" aria-label="Records per period">
        {points.map((p) => (
          <span key={p.key} className="dp-chart__bar" title={`${p.period}: ${p.records.toLocaleString()} records`}>
            <i style={{ height: `${p.height}%` }} />
          </span>
        ))}
      </div>

      <div className="dp-chart__axis">
        <span>{points[0].period}</span>
        <span>{points[points.length - 1].period}</span>
      </div>

      <p className="dp-note">
        {points.length} periods, {count(points.reduce((s, p) => s + p.records, 0))} records in total.
      </p>
    </section>
  );
}

/* ========================================================================== */
/*  CONTRIBUTION                                                              */
/* ========================================================================== */

function ContributionPanel({ profile }: { profile: DepartmentProfile }) {
  const c = profile.contribution;
  const pos = profile.position;

  return (
    <section className="dp-card" aria-label="Organization contribution">
      <h2>Contribution to the organization</h2>

      <dl className="dp-facts dp-facts--wide">
        <div>
          <dt>Operational records</dt>
          <dd>{count(c.records) ?? 'Not measurable'}</dd>
          {c.recordShare !== null && <span className="dp-facts__sub">{pct(c.recordShare, 1)} of attributed activity</span>}
        </div>
        <div>
          <dt>People</dt>
          <dd>{count(c.people)}</dd>
          {c.peopleShare !== null && <span className="dp-facts__sub">{pct(c.peopleShare, 1)} of the workforce</span>}
        </div>
      </dl>

      <ul className="dp-ranks">
        <li>
          <span>Intelligence rank</span>
          <strong>{pos.score.rank === null ? '—' : `#${pos.score.rank} of ${pos.score.of}`}</strong>
        </li>
        <li>
          <span>Activity rank</span>
          <strong>{pos.activity.rank === null ? '—' : `#${pos.activity.rank} of ${pos.activity.of}`}</strong>
        </li>
        <li>
          <span>Size rank</span>
          <strong>{pos.size.rank === null ? '—' : `#${pos.size.rank} of ${pos.size.of}`}</strong>
        </li>
        <li>
          <span>Organization average</span>
          <strong>{pos.organizationAverage === null ? '—' : pos.organizationAverage}</strong>
        </li>
        <li>
          <span>Difference</span>
          <strong className={pos.difference === null ? undefined : pos.difference >= 0 ? 'dp-pos' : 'dp-neg'}>
            {pos.difference === null ? '—' : `${pos.difference >= 0 ? '+' : ''}${pos.difference} pts`}
          </strong>
        </li>
      </ul>
    </section>
  );
}

/* ========================================================================== */
/*  INTELLIGENCE BREAKDOWN                                                    */
/* ========================================================================== */

function IntelligenceBreakdown({ profile }: { profile: DepartmentProfile }) {
  const measured = profile.dimensions.filter((d) => d.score !== null);
  const missing = profile.dimensions.filter((d) => d.score === null);

  return (
    <section className="dp-card" aria-label="Intelligence breakdown">
      <div className="dp-card__head">
        <h2>Intelligence breakdown</h2>
        <span className="dp-chip">
          {profile.measuredCount} of {profile.dimensionCount} measurable · {profile.confidence} confidence
        </span>
      </div>

      <div className="dp-dims">
        {measured.map((d) => <DimensionRow key={d.key} dimension={d} />)}
      </div>

      {missing.length > 0 && (
        <div className="dp-dims dp-dims--missing">
          <h3>Not counted — and not scored as zero</h3>
          {missing.map((d) => (
            <div key={d.key} className="dp-dim dp-dim--missing">
              <div className="dp-dim__head">
                <span className="dp-dim__label">{d.label}</span>
                <span className="dp-dim__value">Not measurable</span>
              </div>
              <p className="dp-dim__basis">{d.basis}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DimensionRow({ dimension }: { dimension: ProfileDimension }) {
  return (
    <div className="dp-dim" data-status={dimension.status ?? 'unknown'}>
      <div className="dp-dim__head">
        <span className="dp-dim__label">{dimension.label}</span>
        <span className="dp-dim__value">{dimension.score}%</span>
      </div>
      <div className="dp-bar dp-bar--sm">
        <i style={{ width: `${Math.max(2, dimension.score ?? 0)}%` }} />
      </div>
      <p className="dp-dim__basis">{dimension.basis}</p>
    </div>
  );
}

/* ========================================================================== */
/*  SIGNALS · EVIDENCE · CASES                                                */
/* ========================================================================== */

function SignalPanel({ profile, onOpenSignals }: { profile: DepartmentProfile; onOpenSignals?: () => void }) {
  const s = profile.signals;

  return (
    <section className="dp-card dp-card--sm" aria-label="Signals">
      <h2><AlertTriangle size={14} /> Signals</h2>
      {s.supported ? (
        <>
          <dl className="dp-facts">
            <div><dt>Against this unit</dt><dd>{count(s.total)}</dd></div>
            <div data-tone={s.open > 0 ? 'warn' : 'good'}><dt>Open</dt><dd>{count(s.open)}</dd></div>
            <div data-tone={s.openHigh > 0 ? 'crit' : 'state'}><dt>High severity</dt><dd>{count(s.openHigh)}</dd></div>
          </dl>
          {s.total === 0 && <p className="dp-note">No signal has been raised against this department.</p>}
          {onOpenSignals && s.total > 0 && <button type="button" className="dp-link" onClick={onOpenSignals}>View signals →</button>}
        </>
      ) : (
        <p className="dp-empty">{s.reason}</p>
      )}
    </section>
  );
}

function EvidencePanel({ profile }: { profile: DepartmentProfile }) {
  const e = profile.evidence;

  return (
    <section className="dp-card dp-card--sm" aria-label="Evidence">
      <h2><FileSearch size={14} /> Evidence</h2>
      {e.supported ? (
        <dl className="dp-facts">
          <div><dt>Linked here</dt><dd>{count(e.total)}</dd></div>
          <div><dt>Organization</dt><dd>{count(e.organizationTotal)}</dd></div>
        </dl>
      ) : (
        <p className="dp-empty">{e.reason}</p>
      )}
    </section>
  );
}

function CasePanel({ profile }: { profile: DepartmentProfile }) {
  const c = profile.cases;

  return (
    <section className="dp-card dp-card--sm" aria-label="Investigations">
      <h2><ClipboardList size={14} /> Investigations</h2>
      {c.supported ? (
        <dl className="dp-facts">
          <div><dt>Involving this unit</dt><dd>{count(c.total)}</dd></div>
          <div data-tone={c.open > 0 ? 'warn' : 'good'}><dt>Open</dt><dd>{count(c.open)}</dd></div>
        </dl>
      ) : (
        <p className="dp-empty">{c.reason}</p>
      )}
    </section>
  );
}

/* ========================================================================== */
/*  PEOPLE                                                                    */
/* ========================================================================== */

function PeoplePanel({ profile, onOpenPeople }: { profile: DepartmentProfile; onOpenPeople?: () => void }) {
  const p = profile.people;

  return (
    <section className="dp-card" aria-label="People">
      <h2><Users size={14} /> People</h2>

      <dl className="dp-facts dp-facts--wide">
        <div><dt>Assigned here</dt><dd>{count(p.total)}</dd></div>
        <div>
          <dt>Records per person</dt>
          <dd>{p.perPerson === null ? 'Not measurable' : p.perPerson.toFixed(1)}</dd>
        </div>
      </dl>

      {p.fields.length > 0 ? (
        <div className="dp-fields">
          {p.fields.map((f) => (
            <div key={f.label} className="dp-field">
              <div className="dp-dim__head">
                <span className="dp-dim__label">{f.label}</span>
                <span className="dp-dim__value">{count(f.have)} of {count(p.total)}</span>
              </div>
              <div className="dp-bar dp-bar--sm">
                <i style={{ width: `${Math.max(2, (f.share ?? 0) * 100)}%` }} />
              </div>
              {f.missing > 0 && <p className="dp-dim__basis">{count(f.missing)} missing.</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="dp-empty">This roster carries none of the fields coverage is measured from.</p>
      )}

      <p className="dp-note">{p.individualReason}</p>
      {onOpenPeople && p.total > 0 && <button type="button" className="dp-link" onClick={onOpenPeople}>View these people →</button>}
    </section>
  );
}

/* ========================================================================== */
/*  HEALTH                                                                    */
/* ========================================================================== */

function HealthPanel({ profile }: { profile: DepartmentProfile }) {
  return (
    <section className="dp-card dp-health" data-status={profile.status} aria-label="Department health">
      <h2>Department health</h2>
      <p className="dp-health__status">
        <span className="dp-health__dot" />
        {profile.statusLabel}
        {profile.score !== null && <em>{profile.score}/100</em>}
      </p>
      <ul className="dp-health__lines">
        {profile.health.lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </section>
  );
}

/* ========================================================================== */
/*  NARRATIVE                                                                 */
/* ========================================================================== */

const NARRATIVE_META: Record<string, { title: string; icon: JSX.Element }> = {
  observation: { title: 'Observation', icon: <Boxes size={14} /> },
  risk: { title: 'Risk', icon: <AlertTriangle size={14} /> },
  opportunity: { title: 'Opportunity', icon: <Lightbulb size={14} /> },
  trend: { title: 'Trend', icon: <TrendingUp size={14} /> },
};

function NarrativePanel({ profile }: { profile: DepartmentProfile }) {
  const grouped = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const n of profile.narrative) (out[n.kind] ??= []).push(n.text);
    return out;
  }, [profile.narrative]);

  if (profile.narrative.length === 0) return null;

  return (
    <section className="dp-card dp-narrative" aria-label="What this department is telling us">
      <h2>What this department is telling us</h2>

      <div className="dp-narrative__grid">
        {Object.entries(NARRATIVE_META).map(([kind, meta]) => {
          const lines = grouped[kind];
          if (!lines || lines.length === 0) return null;

          return (
            <div key={kind} className="dp-narrative__block" data-kind={kind}>
              <h3>{meta.icon}{meta.title}</h3>
              {lines.map((l) => <p key={l}>{l}</p>)}
            </div>
          );
        })}
      </div>

      {/* Said plainly, because a generated paragraph that looks like a model
          wrote it invites the reader to trust it like one. */}
      <p className="dp-note">
        Every sentence above is generated from the figures on this page — counts, shares and rates computed by SQL over
        this organization&apos;s own records. No language model contributed to any of them.
      </p>
    </section>
  );
}

/* ========================================================================== */
/*  NEXT ACTION                                                               */
/* ========================================================================== */

function NextActionPanel({ profile, run }: { profile: DepartmentProfile; run?: () => void }) {
  const a = profile.nextAction;

  return (
    <section className="dp-card dp-action" aria-label="Recommended next action">
      <h2><Target size={14} /> Recommended next action</h2>
      <p className="dp-action__title">{a.title}</p>
      <p className="dp-action__detail">{a.detail}</p>
      {run && (
        <button type="button" className="u-btn u-btn-primary u-btn-sm" onClick={run}>
          {a.target === 'people' ? 'View people' : a.target === 'signals' ? 'View signals' : 'View activity'}
        </button>
      )}
    </section>
  );
}
