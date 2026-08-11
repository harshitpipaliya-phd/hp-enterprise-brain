import { useCallback, useEffect, useState } from 'react';
import { request } from '../../api/client.js';
import { organizationIntelligenceApi } from '../../api/organizationIntelligence';
import type { RecommendationsResponse } from '../../api/organizationIntelligence';
import { Panel, ConsequenceEmpty, Button, Spinner, ErrorState } from '../../ui';
import { IntelligenceHeader, num, count } from './intelligenceUi';
import './OrganizationIntelligence.css';

/**
 * ESO Library (Product Bible §5.7) — "What can this organization actually do?"
 *
 * WHAT WAS HERE BEFORE. Two hardcoded ESO definitions ("Targeted fee reminder",
 * "Attendance intervention") and one hardcoded efficacy record, behind a comment
 * explaining that the real data layer would arrive with the contract pipeline. The
 * effect was a library that looked populated for every organization in the
 * installation, including ones with an empty catalogue — a placeholder is at its most
 * damaging when it is indistinguishable from content.
 *
 * The definitions now come from hpbrain_eso_definitions for the selected
 * organization, with each definition's efficacy records and run count attached. When
 * the catalogue is empty the screen says so, and says what that costs.
 *
 * AND IT NAMES THE DEMAND. Architecture Invariant 3 binds every recommendation to
 * something runnable. The recommendation engine already knows which of the four
 * execution capabilities each action needs, so an empty catalogue can still be
 * specific: not "no ESOs defined", but "eleven actions are waiting on a Workflow
 * capability that does not exist". That is the difference between an empty state and
 * a work list.
 */

interface EfficacyRecord {
  id: string;
  gapType: string | null;
  population: string | null;
  efficacyScore: number | null;
  sampleSize: number | null;
  computedDate: string | null;
}

interface EsoDefinition {
  id: string;
  esoCode: string;
  name: string;
  objective: string | null;
  status: string;
  version: number;
  owner: string | null;
  trustLevel: string | null;
  allowedExecutorClasses: string[];
  gapTypes: string[];
  kasbaNodeType: string | null;
  runs: number;
  lastRun: string | null;
  efficacy: EfficacyRecord[];
}

interface EsoCatalogue {
  definitions: EsoDefinition[];
  totals: { definitions: number; active: number; withEfficacy: number; executions: number };
}

/** The four execution capabilities of the Product Bible, in its order. */
const ESO_TYPES = ['Assessment', 'Learning', 'Workflow', 'Communication'] as const;

export default function EsoLibraryScreen({ tenantId }: { tenantId: string }) {
  const [catalogue, setCatalogue] = useState<EsoCatalogue | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, recs] = await Promise.all([
        request(`/eso-definitions/${encodeURIComponent(tenantId)}`) as Promise<EsoCatalogue>,
        organizationIntelligenceApi.getRecommendations(tenantId),
      ]);
      setCatalogue(cat);
      setRecommendations(recs);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load the ESO catalogue.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !catalogue) {
    return <div className="oi-page"><Spinner label="Loading the ESO catalogue" /></div>;
  }

  if (error && !catalogue) {
    return <div className="oi-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  }

  if (!catalogue) return null;

  const { definitions, totals } = catalogue;
  const chosen = definitions.find((d) => d.id === selected) ?? null;

  // Demand for each execution capability, from the recommendations that need one.
  const demand = ESO_TYPES.map((type) => ({
    type,
    actions: (recommendations?.recommendations ?? []).filter((r) => r.esoType === type),
  })).filter((d) => d.actions.length > 0);

  return (
    <div className="oi-page">
      <IntelligenceHeader
        eyebrow="Knowledge"
        title="ESO Library"
        question="What can this organization actually do — and how well has it worked before?"
        meta={recommendations ?? null}
        actions={<Button variant="secondary" onClick={() => void load()} disabled={loading}>Reload</Button>}
      />

      {error && <div className="u-alert u-alert-danger" style={{ marginBottom: 14 }}><div className="u-alert-body">{error}</div></div>}

      <div className="oi-sections">
        <div className="bl-grid bl-grid--wide-left">
          <Panel
            title="Definitions"
            hint={`${totals.definitions} in the catalogue · ${totals.active} active · ${totals.withEfficacy} with a track record`}
            footnote={
              definitions.length === 0
                ? <>An empty catalogue is not a display problem. <strong>Architecture Invariant 3 requires every recommendation to be bound to something runnable</strong>, and with nothing defined, no recommendation this organization produces can be bound at all — every one of them ends at a description of what should happen.</>
                : <>A definition with no efficacy record has no track record, which is different from having a poor one. Both are shown; neither is inferred from the other.</>
            }
          >
            {definitions.length === 0 ? (
              <ConsequenceEmpty
                missing="an executable object definition for this organization"
                produces="ESOs are authored through the governed catalogue path: a definition names its objective, its allowed executor classes, its trust level and its measurement hooks before it can run."
              />
            ) : (
              <div className="oi-findings">
                {definitions.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    className="oi-finding"
                    onClick={() => setSelected(d.id === selected ? null : d.id)}
                    aria-expanded={d.id === selected}
                    style={{ textAlign: 'left', cursor: 'pointer', width: '100%', font: 'inherit', color: 'inherit' }}
                  >
                    <div className="oi-finding__top">
                      <h4 className="oi-finding__title">{d.name}</h4>
                      <span className="oi-chips">
                        <span className={`oi-chip oi-chip--${d.status === 'active' ? 'ok' : 'info'}`}>{d.status}</span>
                        {d.trustLevel && <span className="oi-chip">trust {d.trustLevel}</span>}
                        <span className="oi-chip oi-chip--mono">{d.runs} run{d.runs === 1 ? '' : 's'}</span>
                      </span>
                    </div>
                    <p className="oi-finding__detail">
                      <code>{d.esoCode}</code> v{d.version}
                      {d.objective ? ` — ${d.objective}` : ''}
                    </p>
                    <div className="oi-finding__meta">
                      <span className="oi-chips">
                        {d.allowedExecutorClasses.length > 0
                          ? d.allowedExecutorClasses.map((c) => <span className="oi-chip" key={c}>{c}</span>)
                          : <span className="oi-chip">no executor class declared</span>}
                        {d.efficacy.length === 0
                          ? <span className="oi-chip oi-chip--warn">no track record</span>
                          : <span className="oi-chip oi-chip--ok">{d.efficacy.length} efficacy record{d.efficacy.length === 1 ? '' : 's'}</span>}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Efficacy"
            hint={chosen ? chosen.esoCode : 'select a definition'}
            footnote="Efficacy is computed from recorded outcomes against the gap type an ESO was run for. A score with a sample size of one is a single observation, and the sample size ships with the score so it cannot be read as a rate."
          >
            {!chosen ? (
              <ConsequenceEmpty
                missing="a selected definition"
                produces={definitions.length === 0
                  ? 'The catalogue is empty, so there is nothing to select.'
                  : 'Choose a definition on the left to see what it has achieved.'}
              />
            ) : chosen.efficacy.length === 0 ? (
              <ConsequenceEmpty
                missing={`an efficacy record for ${chosen.esoCode}`}
                produces={`Efficacy is written when an execution's outcome is measured against its measurement plan. This ESO has run ${chosen.runs} time${chosen.runs === 1 ? '' : 's'} and produced no measured outcome.`}
              />
            ) : (
              <div className="bl-scroll">
                <table className="oi-table">
                  <thead>
                    <tr>
                      <th>Gap type</th>
                      <th>Population</th>
                      <th>Efficacy</th>
                      <th>Sample</th>
                      <th>Computed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chosen.efficacy.map((e) => (
                      <tr key={e.id}>
                        <td className="oi-table__name">{e.gapType ?? 'unspecified'}</td>
                        <td>{e.population ?? '—'}</td>
                        <td className="oi-table__num">{num(e.efficacyScore)}</td>
                        <td className="oi-table__num">
                          {e.sampleSize === null
                            ? '—'
                            : <span className={e.sampleSize < 5 ? 'oi-chip oi-chip--warn' : 'oi-chip oi-chip--mono'}>{count(e.sampleSize)}</span>}
                        </td>
                        <td>{e.computedDate?.slice(0, 10) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="What the organization needs to be able to run"
          hint="execution capability required by each detected action"
          footnote={<>
            Derived from the actions the recommendation engine produced for this organization, each of
            which names the execution capability it needs. <strong>This is the demand side of the
            catalogue</strong>: it says what an ESO would have to do here, computed from detected gaps
            rather than chosen from a menu.
          </>}
        >
          {demand.length === 0 ? (
            <ConsequenceEmpty
              missing="a detected gap or risk needing execution"
              produces="Nothing is currently waiting on an executable capability."
            />
          ) : (
            <div className="bl-grid bl-grid--2" style={{ gap: 12 }}>
              {demand.map((d) => (
                <div className="oi-block" key={d.type}>
                  <div className="oi-block__label">
                    {d.type}
                    <span className="oi-chip oi-chip--mono">{d.actions.length} action{d.actions.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="oi-block__body">
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {d.actions.slice(0, 4).map((a) => (
                        <li key={a.id} style={{ marginBottom: 3 }}>
                          {a.recommendation} <span className="oi-chip oi-chip--mono">#{a.rank}</span>
                        </li>
                      ))}
                    </ul>
                    {d.actions.length > 4 && (
                      <p className="bc-note">and {d.actions.length - 4} more.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Execution to date" hint="what has actually run">
          <div className="bl-grid bl-grid--3" style={{ gap: 12 }}>
            <div className="oi-block">
              <div className="oi-block__label">Definitions</div>
              <div className="oi-block__body"><strong style={{ fontSize: 17 }}>{count(totals.definitions)}</strong></div>
            </div>
            <div className="oi-block">
              <div className="oi-block__label">Executions recorded</div>
              <div className="oi-block__body"><strong style={{ fontSize: 17 }}>{count(totals.executions)}</strong></div>
            </div>
            <div className="oi-block">
              <div className="oi-block__label">Definitions with a track record</div>
              <div className="oi-block__body"><strong style={{ fontSize: 17 }}>{count(totals.withEfficacy)}</strong></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
