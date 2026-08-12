/**
 * Presentational pieces shared by the organization-intelligence screens.
 *
 * NOTHING HERE COMPUTES ANYTHING. Every component takes a derived value and renders
 * it. There is no arithmetic beyond turning a 0..1 into a percentage for display,
 * which is formatting, not derivation. If a screen needs a figure that is not in the
 * API response, the fix is in the engine — a number computed in a component is a
 * second definition of that number, and the two will disagree.
 *
 * NULL RENDERS AS AN EXPLANATION, NEVER AS ZERO. Confidence, scores and severities
 * all arrive nullable, and every component below has a distinct visual for the null
 * case. That is the product rule these components exist to make unavoidable: "we
 * have never looked" and "the answer is none" support opposite decisions.
 */

import React from 'react';
import { Panel } from '../../ui';
import type {
  ConfidenceValue, EvidenceRef, ExecutiveInterpretation, Provenance, Recommendation, StateDimension, Gap,
} from '../../api/organizationIntelligence';

/** 0..1 as a percentage string. Formatting only. */
export const pct = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;

export const num = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

export const count = (value: number | null | undefined): string =>
  value === null || value === undefined ? '—' : value.toLocaleString();

/* ─────────────────────────── confidence ─────────────────────────── */

/**
 * Confidence as a number and a bar, with the components behind it on hover.
 *
 * The number is always shown alongside the bar. A bar alone hides whether it was
 * 0.51 or 0.74, and those justify different actions.
 */
export function ConfidenceBar({ confidence, showBand }: { confidence: ConfidenceValue | null | undefined; showBand?: boolean }) {
  const value = confidence?.value ?? null;

  if (value === null) {
    return <span className="oi-conf__none" title="No component of this confidence could be measured for this organization.">undetermined</span>;
  }

  const title = [
    `confidence ${value.toFixed(4)} (${confidence?.band})`,
    ...(confidence?.components ?? []).map((c) =>
      `${c.key} ×${c.weight}: ${c.value === null ? 'not measurable' : c.value.toFixed(2)} — ${c.basis}`),
    ...(confidence?.unmeasured?.length
      ? [`weight redistributed from: ${confidence.unmeasured.join(', ')}`]
      : []),
  ].join('\n');

  return (
    <span className="oi-conf" title={title}>
      <span className={`oi-conf__bar${value < 0.5 ? ' oi-conf__bar--low' : ''}`} role="img"
        aria-label={`Confidence ${(value * 100).toFixed(0)} per cent`}>
        <i style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </span>
      <span className="oi-conf__val">{value.toFixed(2)}</span>
      {showBand && <span className="oi-chip">{confidence?.band}</span>}
    </span>
  );
}

/**
 * The components a confidence is made of, expanded.
 *
 * A component with no input is shown as "not measurable" in warning colour rather
 * than being hidden, because its absence is why the score rests on a narrower basis
 * than intended — and that is exactly what a sceptical reader came here to find.
 */
export function ConfidenceFactors({ confidence }: { confidence: ConfidenceValue }) {
  return (
    <div className="oi-factors">
      {confidence.components.map((c) => (
        <div className="oi-factor" key={c.key}>
          <span className="oi-factor__key">{c.key} ×{c.weight}</span>
          <span className={`oi-factor__val${c.value === null ? ' oi-factor__val--none' : ''}`}>
            {c.value === null ? 'n/a' : c.value.toFixed(2)}
          </span>
          <span className="oi-factor__basis">{c.basis}</span>
        </div>
      ))}
      {confidence.unmeasured.length > 0 && (
        <div className="oi-factor">
          <span className="oi-factor__key">redistributed</span>
          <span className="oi-factor__val--none oi-factor__val">—</span>
          <span className="oi-factor__basis">
            {confidence.unmeasured.join(', ')} had no input, so {confidence.unmeasured.length === 1 ? 'its weight was' : 'their weights were'} shared
            across the components that could be measured — never scored zero.
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── provenance ─────────────────────────── */

/**
 * The receipt behind a figure: the arithmetic, the tables, the filters, the counts.
 *
 * Collapsed by default and present on everything material. A number whose source
 * cannot be opened is an assertion, which is the thing this product replaces.
 */
export function ProvenanceDetails({ provenance, summary = 'How this was computed' }: { provenance: Provenance; summary?: string }) {
  return (
    <details className="oi-prov">
      <summary>{summary}</summary>
      <div className="oi-prov__body">
        <code>{provenance.computation}</code>
        {provenance.sources.map((source, i) => (
          <span className="oi-prov__src" key={`${source.table}-${i}`}>
            <code>{source.table}</code> where{' '}
            <code>
              {Object.entries(source.filter)
                .map(([k, v]) => `${k} = ${v === null ? 'NULL' : String(v)}`)
                .join(' and ') || 'no filter'}
            </code>{' '}
            → <strong>{source.rows.toLocaleString()}</strong> rows
          </span>
        ))}
      </div>
    </details>
  );
}

/** Evidence as counted rows, with the table each count came from. */
export function EvidenceList({ evidence }: { evidence: EvidenceRef[] }) {
  if (evidence.length === 0) {
    return <span className="oi-chip">no evidence on file</span>;
  }

  return (
    <span className="oi-chips">
      {evidence.map((e, i) => (
        <span className="oi-chip oi-chip--mono" key={`${e.what}-${i}`} title={e.table ? `from ${e.table}` : undefined}>
          {e.count.toLocaleString()} · {e.what}
        </span>
      ))}
    </span>
  );
}

/* ─────────────────────────── maturity ladder ─────────────────────────── */

/**
 * The loop stages as a ladder, each expandable to its factors.
 *
 * A dimension with a null score is HATCHED, not drawn at zero. That single visual
 * decision is what keeps "the organization has never recorded an outcome" from
 * reading as "the organization is bad at learning".
 */
export function DimensionLadder({ dimensions }: { dimensions: StateDimension[] }) {
  const [open, setOpen] = React.useState<string | null>(null);

  return (
    <div className="oi-dims">
      {dimensions.map((d) => {
        const expanded = open === d.key;
        const strong = d.score !== null && d.score >= 0.65;
        const weak = d.score !== null && d.score < 0.4;

        return (
          <React.Fragment key={d.key}>
            <button
              type="button"
              className="oi-dim"
              onClick={() => setOpen(expanded ? null : d.key)}
              aria-expanded={expanded}
            >
              <span className="oi-dim__label">
                <span className="oi-dim__name">{d.label}</span>
                <span className="oi-dim__move">{d.movement} · weight {d.weight.toFixed(2)}</span>
              </span>

              {d.score === null ? (
                <span className="oi-dim__track oi-dim__track--none" role="img" aria-label="Never measured" />
              ) : (
                <span className="oi-dim__track">
                  <i
                    className={`oi-dim__fill${weak ? ' oi-dim__fill--weak' : strong ? ' oi-dim__fill--strong' : ''}`}
                    style={{ width: `${Math.round(d.score * 100)}%` }}
                  />
                </span>
              )}

              <span className={`oi-dim__score${d.score === null ? ' oi-dim__score--none' : ''}`}>
                {d.score === null ? 'undetermined' : d.score.toFixed(2)}
                {d.score !== null && <small>{d.stage}</small>}
              </span>
            </button>

            {expanded && (
              <>
                <p className="bc-note">{d.why}</p>
                {d.blocking && <p className="bc-note bc-note--warn">{d.blocking}</p>}
                <ConfidenceFactors confidence={{ value: d.score, band: d.band as ConfidenceValue['band'], components: d.factors, unmeasured: d.unmeasured }} />
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── recommendation ─────────────────────────── */

/**
 * One recommendation, with everything needed to act on it or reject it.
 *
 * The benefit block always carries its support label. The execution note always says
 * that nothing is bound yet and why. Neither is optional formatting: a benefit
 * without a label reads as a promise, and a recommendation that looks runnable and
 * is not wastes somebody's afternoon.
 */
export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const r = recommendation;

  return (
    <article className={`oi-rec oi-rec--${r.priority}`}>
      <div className="oi-rec__top">
        <span className="oi-rec__rank">#{r.rank}</span>
        <h4 className="oi-rec__title">{r.recommendation}</h4>
        <span className="oi-chips">
          <span className={`oi-chip oi-chip--${r.priority === 'critical' ? 'crit' : r.priority === 'high' ? 'warn' : 'info'}`}>
            {r.priority}
          </span>
          {r.urgency !== 'steady' && <span className="oi-chip oi-chip--warn">{r.urgency}</span>}
          <span className="oi-chip">{r.area}</span>
          <ConfidenceBar confidence={r.confidence} />
        </span>
      </div>

      <p className="oi-rec__why">{r.why}</p>

      <div className="oi-rec__grid">
        <div className="oi-block">
          <div className="oi-block__label">Finding</div>
          <div className="oi-block__body">
            {r.finding}
            <div style={{ marginTop: 6 }}><EvidenceList evidence={r.evidence} /></div>
          </div>
        </div>

        <div className="oi-block">
          <div className="oi-block__label">
            Expected benefit
            <span className={`oi-label oi-label--${r.benefit.label.toLowerCase()}`}>{r.benefit.label}</span>
          </div>
          <div className="oi-block__body">
            <strong>{r.benefit.category}</strong> — {r.benefit.statement}
            {r.benefit.currentValue !== null && (
              <div style={{ marginTop: 5 }}>
                <span className="oi-chip oi-chip--mono">
                  now {num(r.benefit.currentValue)}
                  {r.benefit.targetValue !== null ? ` → ${num(r.benefit.targetValue)}` : ''}
                  {r.benefit.unit ? ` ${r.benefit.unit}` : ''}
                </span>
              </div>
            )}
            <div style={{ marginTop: 5, color: 'var(--content-tertiary)' }}>{r.benefit.why}</div>
          </div>
        </div>

        <div className="oi-block">
          <div className="oi-block__label">Priority &amp; effort</div>
          <div className="oi-block__body">
            <span className="oi-chip oi-chip--mono">score {num(r.priorityScore)}</span>{' '}
            <span className="oi-chip oi-chip--mono">severity {num(r.severity)}/5</span>{' '}
            <span className="oi-chip oi-chip--mono">tractability {num(r.tractability)}</span>
            <div style={{ marginTop: 6 }}>
              {r.effort.measurable
                ? <><strong>{count(r.effort.value)} {r.effort.unit}</strong>. {r.effort.basis}</>
                : r.effort.basis}
            </div>
          </div>
        </div>

        <div className="oi-block">
          <div className="oi-block__label">Execution</div>
          <div className="oi-block__body">
            Needs a <strong>{r.esoType}</strong> capability. {r.esoNote}
          </div>
        </div>
      </div>

      <div className="oi-rec__next">
        <b>Next action</b>
        {r.nextAction}
      </div>

      {r.dependencies.length > 0 && (
        <p className="oi-rec__dep">
          Blocked by {r.dependencies.length} other {r.dependencies.length === 1 ? 'action' : 'actions'}: {r.dependencies.map((d) => d.because).join(' ')}
        </p>
      )}

      <ProvenanceDetails provenance={r.provenance} summary="Where this came from" />
    </article>
  );
}

/* ─────────────────────────── gap ─────────────────────────── */

/** One gap: what is absent, how much it touches, and what would close it. */
export function ExecutiveInterpretationPanel({ interpretation }: { interpretation: ExecutiveInterpretation | null | undefined }) {
  if (!interpretation) return null;

  const available = interpretation.status === 'available';
  const findings = interpretation.critical_findings.slice(0, 3);
  const actions = interpretation.recommendations.slice(0, 3);

  return (
    <Panel
      title="Executive interpretation"
      hint={available ? `DeepSeek - ${interpretation.model ?? 'configured model'}` : 'DeepSeek unavailable'}
      footnote={<span>{interpretation.guardrails.model_role} {interpretation.guardrails.facts}</span>}
    >
      {!available && (
        <div className="oi-ai-unavailable">
          <strong>Interpretation unavailable.</strong>
          <span>{interpretation.reason ?? 'unknown'}{interpretation.detail ? `: ${interpretation.detail}` : ''}</span>
        </div>
      )}

      <p className="oi-ai-summary">{interpretation.executive_summary}</p>

      {available && (
        <div className="oi-ai-grid">
          <div className="oi-ai-section">
            <h4>Most Important Findings</h4>
            {findings.length === 0 ? (
              <p className="bc-note">No model finding was accepted for this data version.</p>
            ) : findings.map((finding) => (
              <article className="oi-ai-card" key={finding.title}>
                <div className="oi-finding__top">
                  <span className={`oi-chip oi-chip--${finding.severity === 'critical' ? 'crit' : finding.severity === 'high' ? 'warn' : 'info'}`}>
                    {finding.severity}
                  </span>
                  <h4 className="oi-finding__title">{finding.title}</h4>
                  <span className="oi-chip oi-chip--mono">conf {num(finding.confidence)}</span>
                </div>
                <p><strong>Observed.</strong> {finding.observed_fact}</p>
                <p><strong>Inference.</strong> {finding.inference}</p>
                <p><strong>Why it matters.</strong> {finding.why_it_matters}</p>
                {finding.evidence.length > 0 && (
                  <div className="oi-chips">{finding.evidence.slice(0, 3).map((e) => <span className="oi-chip" key={e}>{e}</span>)}</div>
                )}
              </article>
            ))}
          </div>

          <div className="oi-ai-section">
            <h4>Prioritized Actions</h4>
            {actions.length === 0 ? (
              <p className="bc-note">No model action was accepted for this data version.</p>
            ) : actions.map((action) => (
              <article className="oi-ai-card" key={action.title}>
                <div className="oi-finding__top">
                  <span className={`oi-chip oi-chip--${action.priority === 'critical' ? 'crit' : action.priority === 'high' ? 'warn' : 'info'}`}>
                    {action.priority}
                  </span>
                  <h4 className="oi-finding__title">{action.title}</h4>
                  <span className="oi-chip oi-chip--mono">conf {num(action.confidence)}</span>
                </div>
                <p><strong>Observed.</strong> {action.observed_fact}</p>
                <p><strong>Action.</strong> {action.action}</p>
                <p><strong>How.</strong> {action.how}</p>
                <p><strong>Expected benefit.</strong> {action.expected_benefit}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function GapRow({ gap }: { gap: Gap }) {
  return (
    <article className="oi-finding">
      <div className="oi-finding__top">
        <span className={`oi-chip oi-chip--${gap.band === 'critical' ? 'crit' : gap.band === 'high' ? 'warn' : 'info'}`}>
          {gap.band}
        </span>
        <h4 className="oi-finding__title">{gap.title}</h4>
        <span className="oi-chips">
          <span className="oi-chip oi-chip--mono">severity {num(gap.severity)}/5</span>
          <ConfidenceBar confidence={gap.confidence} />
        </span>
      </div>

      <p className="oi-finding__detail">{gap.detail}</p>
      <p className="oi-finding__detail"><strong>Why it matters.</strong> {gap.whyItMatters}</p>
      <p className="oi-finding__detail"><strong>Closed when.</strong> {gap.closedWhen}</p>

      <div className="oi-finding__meta">
        <span className="oi-chips">
          <span className="oi-chip">{gap.area}</span>
          <span className="oi-chip oi-chip--mono">reach {pct(gap.reach)}</span>
          <span className="oi-chip oi-chip--mono">consequence {num(gap.consequence)}</span>
        </span>
        <div style={{ marginTop: 6 }}><EvidenceList evidence={gap.evidence} /></div>
        <p className="bc-note">{gap.reachBasis}</p>
      </div>

      <ProvenanceDetails provenance={gap.provenance} />
    </article>
  );
}

/* ─────────────────────────── page furniture ─────────────────────────── */

export function IntelligenceHeader({
  eyebrow, title, question, meta, actions,
}: {
  eyebrow: string;
  title: string;
  question: string;
  meta?: { dataVersion: string; computedAt: string; computeMs: number } | null;
  actions?: React.ReactNode;
}) {
  return (
    <header className="oi-head">
      <div className="oi-head__text">
        <p className="oi-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="oi-question">{question}</p>
      </div>
      <div className="oi-head__aside">
        {actions}
        {meta && (
          <div className="oi-stamp" title="Fingerprint of the source rows this was computed from. Two panels showing the same version describe the same state of the organization.">
            data version {meta.dataVersion}
            <br />
            derived in {meta.computeMs} ms · {new Date(meta.computedAt).toLocaleString()}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * The standing statement that no language model touched these figures.
 *
 * On the screen rather than in documentation, because that is where a reader
 * forms their belief about whether a number can be trusted.
 */
export function DerivationFooter({ derivation }: { derivation: { method: string; llm: string; scope: string; liveness: string } }) {
  return (
    <div className="oi-derivation">
      <span><b>Method.</b> {derivation.method}</span>
      <span><b>No model output.</b> {derivation.llm}</span>
      <span><b>Scope.</b> {derivation.scope}</span>
      <span><b>Freshness.</b> {derivation.liveness}</span>
    </div>
  );
}
