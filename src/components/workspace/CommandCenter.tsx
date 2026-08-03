import { useState, useEffect } from 'react';
import { decisionIntelligenceApi } from '../../api/intelligence';
import { reasoningEngineApi } from '../../api/reasoning-engine';
import { notificationApi } from '../../api/notification';
import { aiApi } from '../../api/ai';
import { taskApi } from '../../api/task';
import { LoadingState, ErrorState } from '../shared/States';
import type { View } from '../../App';

interface CommandCenterProps {
  tenantId: string;
  onNavigate: (view: View) => void;
}

/**
 * Command Center — the home screen. A single pane of glass over numbers that
 * other screens already compute correctly; this composes them and offers a
 * route into each.
 *
 * STYLED WITH THE DESIGN SYSTEM, NOT INLINE STYLES. Every rule here comes from
 * a token or an eb- class. The previous version hardcoded '#22c55e', '#f59e0b'
 * and '#ef4444' in the markup, so this screen ignored the theme it was mounted
 * in, drifted from every other screen, and could not follow a palette change.
 * Status now comes from the reserved status tokens.
 *
 * STATUS IS NEVER COLOUR ALONE. Each health signal carries a word — Healthy,
 * Attention, Critical — beside its colour, so the state survives a monochrome
 * display, a printout, and a reader with a colour-vision deficiency.
 */
export default function CommandCenter({ tenantId, onNavigate }: CommandCenterProps) {
  const [summary, setSummary] = useState<any>(null);
  const [missingEvidence, setMissingEvidence] = useState(0);
  const [duplicates, setDuplicates] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [aiExecutions, setAiExecutions] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.all([
      decisionIntelligenceApi.getExecutiveSummary(tenantId),
      reasoningEngineApi.missingEvidence(tenantId),
      reasoningEngineApi.duplicateSignals(tenantId),
      notificationApi.unreadCount(tenantId),
      aiApi.executions(tenantId),
      aiApi.providers(),
      taskApi.listRegistry(),
    ])
      .then(([summaryRes, missingRes, dupRes, unreadRes, execRes, providerRes, tasksRes]) => {
        // Guards a tenant switch whose older request resolves last: without it
        // the slower of two in-flight loads wins and the screen shows the
        // organization the user just navigated away from.
        if (cancelled) return;

        // NORMALISED, NOT TRUSTED.
        //
        // `providers.filter is not a function` took this whole screen down in
        // production. The cause was a shadowed route serving a different shape
        // (see routes/api.php), and that is fixed — but the lesson stands: a
        // dashboard that composes seven independent endpoints will eventually
        // meet one that answers differently than expected, and the right
        // outcome is a tile reading zero, not a white screen where the other
        // six numbers used to be.
        //
        // Only the shape is defended here. Nothing is invented: an absent list
        // becomes an empty list, which is what "we were told nothing" means.
        setSummary({
          intelligenceScore: { score: 0, ...(summaryRes?.intelligenceScore ?? {}) },
          pendingRecommendations: asArray(summaryRes?.pendingRecommendations),
          openDecisionsCount: Number(summaryRes?.openDecisionsCount ?? 0),
          topRisks: asArray(summaryRes?.topRisks),
        });
        setMissingEvidence(Number(missingRes?.count ?? 0));
        setDuplicates(Number(dupRes?.count ?? 0));
        setUnreadNotifications(Number(unreadRes?.count ?? 0));
        setAiExecutions(asArray(execRes).slice(0, 5));
        setProviders(asArray(providerRes?.providers));
        setTaskCount(asArray(tasksRes).length);
      })
      .catch((e: any) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) return <LoadingState label="Loading command center..." />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return null;

  const configuredProviders = providers.filter((p) => p.available).length;
  const qualityAlerts = missingEvidence + duplicates;
  const score = summary.intelligenceScore.score;
  const health = healthOf(score);

  return (
    <div className="eb-fade-in">
      {/* ---- Welcome banner --------------------------------------------- */}
      <header className="eb-hero">
        <div className="eb-hero-copy">
          <span className="eb-hero-date">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </span>
          <h1>Command Center</h1>
          <p>Every signal, decision and risk in one view. Select any card to open its full screen.</p>
        </div>

        {/* The headline number gets the hero slot rather than a tile: it is the
            one figure that answers "should I be worried?" on its own. */}
        <div className="eb-hero-score" role="group" aria-label="Organizational intelligence score">
          <div className="eb-hero-ring" data-health={health}>
            <span className="eb-hero-ring-value">{score}</span>
            <span className="eb-hero-ring-max">/ 100</span>
          </div>
          <div className="eb-hero-score-meta">
            <span className="eb-hero-score-label">Intelligence Score</span>
            <span className={`eb-badge eb-badge-${badgeOf(health)}`}>{labelOf(health)}</span>
          </div>
        </div>
      </header>

      {/* ---- KPI row ------------------------------------------------------ */}
      <section aria-labelledby="cc-overview">
        <div className="eb-section-head">
          <h2 id="cc-overview">Overview</h2>
        </div>

        <div className="eb-kpi-grid">
          <Kpi label="Pending Recommendations" value={summary.pendingRecommendations.length}
            hint="Awaiting review" onClick={() => onNavigate('executive')} />
          <Kpi label="Open Decisions" value={summary.openDecisionsCount}
            hint="Not yet resolved" onClick={() => onNavigate('executive')} />
          <Kpi label="Top Risks" value={summary.topRisks.length}
            hint={summary.topRisks.length > 0 ? 'Needs attention' : 'None recorded'}
            health={summary.topRisks.length > 0 ? 'warn' : 'good'}
            onClick={() => onNavigate('executive')} />
          <Kpi label="Data Quality Alerts" value={qualityAlerts}
            hint={`${missingEvidence} missing evidence · ${duplicates} duplicate`}
            health={qualityAlerts > 0 ? 'warn' : 'good'}
            onClick={() => onNavigate('executive')} />
          <Kpi label="Unread Notifications" value={unreadNotifications} hint="Across this organization" />
          <Kpi label="AI Providers" value={`${configuredProviders}/${providers.length}`}
            hint={configuredProviders > 0 ? 'Configured' : 'None configured'}
            health={configuredProviders > 0 ? 'good' : 'warn'}
            onClick={() => onNavigate('aiworkspace')} />
          <Kpi label="Available Tasks" value={taskCount} hint="In the registry"
            onClick={() => onNavigate('tasks')} />
          <Kpi label="Evidence Gaps" value={missingEvidence} hint="Claims without support"
            health={missingEvidence > 0 ? 'warn' : 'good'}
            onClick={() => onNavigate('evidence')} />
        </div>
      </section>

      {/* ---- Two-column detail -------------------------------------------- */}
      <div className="eb-split">
        <section className="eb-panel" aria-labelledby="cc-risks">
          <div className="eb-section-head">
            <h2 id="cc-risks">Top Risks</h2>
            <button className="eb-link-btn" onClick={() => onNavigate('executive')}>See all</button>
          </div>

          {summary.topRisks.length === 0 ? (
            <p className="eb-panel-empty">No risks assessed yet.</p>
          ) : (
            <ul className="eb-list">
              {summary.topRisks.slice(0, 5).map((r: any) => (
                <li key={r.id} className="eb-list-row">
                  <span className="eb-list-title">{r.category}</span>
                  <span className="eb-list-meta">Score {r.score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="eb-panel" aria-labelledby="cc-ai">
          <div className="eb-section-head">
            <h2 id="cc-ai">Recent AI Activity</h2>
            <button className="eb-link-btn" onClick={() => onNavigate('aiworkspace')}>See all</button>
          </div>

          {aiExecutions.length === 0 ? (
            <p className="eb-panel-empty">No AI executions yet.</p>
          ) : (
            <ul className="eb-list">
              {aiExecutions.map((e: any) => (
                <li key={e.id} className="eb-list-row">
                  <span className="eb-list-title">{e.serviceName}</span>
                  <span className={`eb-badge eb-badge-${execBadge(e.status)}`}>{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="eb-hint">
        Press <kbd>Ctrl</kbd> + <kbd>K</kbd> anywhere to jump straight to any screen.
      </p>
    </div>
  );
}

/**
 * Whatever we were handed, as a list.
 *
 * Also covers the case that caused the outage: an endpoint returning a
 * name-keyed OBJECT where the caller expected an array. Object.values() makes
 * that usable rather than fatal, and an unexpected scalar becomes [] — the
 * honest reading of "nothing we can enumerate".
 */
function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

type Health = 'good' | 'warn' | 'crit';

function healthOf(score: number): Health {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warn';
  return 'crit';
}

function labelOf(h: Health): string {
  return h === 'good' ? 'Healthy' : h === 'warn' ? 'Attention' : 'Critical';
}

function badgeOf(h: Health): string {
  return h === 'good' ? 'success' : h === 'warn' ? 'warning' : 'danger';
}

function execBadge(status: string): string {
  if (status === 'success') return 'success';
  // 'not_configured' is a neutral fact about setup, not a failure to act on.
  if (status === 'not_configured') return 'info';
  return 'danger';
}

function Kpi({
  label, value, hint, health, onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  health?: Health;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="eb-kpi-label">{label}</span>
      <span className="eb-kpi-value">{value}</span>
      {hint && <span className="eb-kpi-hint">{hint}</span>}
    </>
  );

  // A real <button> when it navigates, a plain <div> when it does not. Making
  // every tile a button would promise a destination half of them lack, and put
  // dead stops in the keyboard tab order.
  return onClick ? (
    <button type="button" className="eb-kpi eb-kpi-action" data-health={health} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="eb-kpi" data-health={health}>{content}</div>
  );
}
