import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ExternalLink, Pencil, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '../../../ui';
import { ErrorState } from '../../shared/States';
import { api as intelligenceApi } from '../../../api/departmentIntelligence';
import type { DepartmentIntelligence } from '../../../api/departmentIntelligence';
import { caseApi } from '../../../api/case';
import { VerdictHero } from './VerdictHero';
import { SinceRefreshStrip } from './SinceRefreshStrip';
import { StatTiles } from './StatTiles';
import { DepartmentStatePanel } from './DepartmentStatePanel';
import { MeasureList } from './MeasureList';
import { ActivityChart } from './ActivityChart';
import { PeopleRoster } from './PeopleRoster';
import { ContributionPanel } from './ContributionPanel';
import { CapabilityPanel } from './CapabilityPanel';
import { SignalsPanel } from './SignalsPanel';
import { FlowPanel } from './FlowPanel';
import { BlindSpotsFold } from './BlindSpotsFold';
import { ScoreExplainFold } from './ScoreExplainFold';
import { RecommendationPanel } from './RecommendationPanel';
import { PanelSkeleton, SectionHeading, Skeleton } from '../../intelligence/parts';
import '../../intelligence/intelligence.css';

/**
 * THE DEPARTMENT INTELLIGENCE SCREEN.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ONE REQUEST, ONE JUDGEMENT
 *
 * Everything below comes from a single endpoint. This component fetches it,
 * decides what is loading and what failed, and hands each section its slice —
 * it computes no figure of its own, because the score, the ranks, the confidence
 * and the projection are all derived from organization-wide aggregates a browser
 * would need every department's records to reproduce.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * PAGING THE ROSTER DOES NOT RE-RENDER THE VERDICT
 *
 * A page change re-fetches, because the roster page lives on the server, but the
 * previous payload stays mounted while it does. Only the roster dims. Blanking
 * the verdict to page a list would make the reader lose their place in the thing
 * they came for.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * FAILURE IS A SCREEN, NOT A CONSOLE MESSAGE
 *
 * A failed load renders in the interface's own voice with a retry, and never a
 * raw error string: the reader cannot act on a stack trace, and a screen that
 * shows one has decided its own convenience matters more than theirs.
 */

const PAGE_SIZE = 5;

export default function DepartmentIntelligenceScreen({
  tenantId,
  departmentId,
  onBack,
  onNavigate,
  onOpenPerson,
  onEdit,
  onExploreInGraph,
}: {
  tenantId: string;
  departmentId: string;
  onBack?: () => void;
  /** Routes a blind-spot fix into the real screen that closes it. */
  onNavigate?: (route: string) => void;
  onOpenPerson?: (personId: string) => void;
  onEdit?: () => void;
  onExploreInGraph?: () => void;
}) {
  const [data, setData] = useState<DepartmentIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [caseNote, setCaseNote] = useState<string | null>(null);

  // Guards a response from a request the user has already navigated past.
  const requestId = useRef(0);

  const load = useCallback(
    async (nextPage: number, fresh = false) => {
      const id = ++requestId.current;

      // The first load blanks the page; every later one leaves the previous
      // payload up so the reader keeps their place.
      if (data === null) setLoading(true);
      else if (fresh) setRefreshing(true);
      else setPaging(true);

      setError(null);

      try {
        const payload = await intelligenceApi.get(tenantId, departmentId, {
          page: nextPage,
          pageSize: PAGE_SIZE,
          fresh,
        });

        if (id !== requestId.current) return;

        setData(payload);
        // The server clamps the page to what exists; follow it rather than
        // holding a page number the roster does not have.
        setPage(payload.people.page);
      } catch (e) {
        if (id !== requestId.current) return;

        setError(e instanceof Error ? e.message : 'unknown');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setPaging(false);
          setRefreshing(false);
        }
      }
    },
    [tenantId, departmentId, data],
  );

  useEffect(() => {
    setData(null);
    setPage(1);
    load(1);
    // Deliberately keyed on the unit alone: `load` closes over `data`, and
    // depending on it here would re-fetch on every response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, departmentId]);

  const openCase = async () => {
    if (!data) return;

    try {
      await caseApi.createCase({
        title: `${data.department.name}: ${data.recommendation.title}`,
        signalId: data.signals.find((s) => s.open)?.id ?? null,
      });
      setCaseNote('Case opened. It is now in the Cases workspace.');
    } catch (e) {
      setCaseNote(
        e instanceof Error
          ? `The case could not be opened: ${e.message}`
          : 'The case could not be opened.',
      );
    }
  };

  /* ---------------------------------------------------------------- failure */

  if (error && data === null) {
    return (
      <div className="dv">
        <ErrorState
          title="Couldn't load department intelligence"
          message="Retry, or check whether this organization's sources are still connected in Ingestion."
          onRetry={() => load(page)}
        />
        {onNavigate && (
          <div>
            <Button variant="ghost" onClick={() => onNavigate('ingestion')}>
              Check Ingestion status →
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- loading */

  if (loading || data === null) {
    return (
      <div className="dv" aria-busy="true">
        <span className="u-sr-only" role="status">
          Loading department intelligence
        </span>
        <Skeleton height={68} />
        <Skeleton height={196} />
        <Skeleton height={64} />
        <div className="dv-tiles">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={78} />
          ))}
        </div>
        <div className="dv-cols dv-cols--wide">
          <PanelSkeleton rows={6} />
          <div className="dv-stack">
            <PanelSkeleton />
            <PanelSkeleton />
          </div>
        </div>
        <PanelSkeleton rows={5} />
      </div>
    );
  }

  /* ------------------------------------------------------------------ ready */

  const fix = (route: string) => onNavigate?.(route);

  return (
    <div className="dv">
      {/*
        THE ORGANIZATION BAND IS GONE, ITS CONTROLS ARE NOT.

        A repeat of the organization's name, tags and score above every
        department pushed the verdict — the thing the reader opened the page for
        — below the fold, and said nothing the Departments list had not already
        said on the way in. What it uniquely carried were these four actions, so
        they stay, on the same row as the back link where a toolbar belongs.

        The organization's average health did not go with it: it is still on the
        page, in Contribution, beside this unit's score where the comparison is
        the point rather than decoration.
      */}
      <div className="dv-toolbar">
        {onBack && (
          <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} aria-hidden="true" />} onClick={onBack}>
            Departments
          </Button>
        )}

        <div className="dv-toolbar__actions">
          {onExploreInGraph && (
            <Button variant="secondary" size="sm" icon={<Share2 size={14} aria-hidden="true" />} onClick={onExploreInGraph}>
              Explore in graph
            </Button>
          )}
          {onNavigate && (
            <Button variant="secondary" size="sm" icon={<ExternalLink size={14} aria-hidden="true" />} onClick={() => fix('ingestion')}>
              Open in Ingestion
            </Button>
          )}
          {onEdit && (
            <Button variant="secondary" size="sm" icon={<Pencil size={14} aria-hidden="true" />} onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            loading={refreshing}
            icon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={() => load(page, true)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* A failure on a REFRESH keeps the last good payload on screen and says
          so, rather than throwing away a working page for an error banner. */}
      {error && (
        <div className="dv-empty">
          <b>That refresh didn't complete</b>
          <span>What you see below is the last answer that did. Try again, or check Ingestion.</span>
          <Button variant="ghost" size="sm" onClick={() => load(page, true)}>
            Retry
          </Button>
        </div>
      )}

      <VerdictHero department={data.department} health={data.health} confidence={data.confidence} />

      <SinceRefreshStrip sinceRefresh={data.sinceRefresh} />

      <StatTiles tiles={data.tiles} />

      <SectionHeading
        title="Department state"
        sub="what is done and what needs doing — read from the imported records"
      />
      <div className="dv-cols dv-cols--wide">
        <DepartmentStatePanel state={data.state} />
        <div className="dv-stack">
          <MeasureList title="Performance" measures={data.performance} />
          <MeasureList title="Workload" measures={data.workload} />
        </div>
      </div>

      <SectionHeading title="Activity over time" sub="work arriving against work finishing" />
      <ActivityChart activity={data.activity} onFix={() => fix('ingestion')} />

      <SectionHeading title="People in this department" />
      <PeopleRoster
        people={data.people}
        loading={paging}
        onPage={(next) => {
          setPage(next);
          load(next);
        }}
        onOpenPerson={onOpenPerson}
      />

      <SectionHeading title="Standing and capability" />
      <div className="dv-cols">
        <ContributionPanel contribution={data.contribution} />
        <CapabilityPanel capabilities={data.capabilities} onFix={() => fix('capabilities')} />
      </div>

      <SectionHeading title="Signals and flow" />
      <div className="dv-cols">
        <SignalsPanel signals={data.signals} onOpenSignals={() => fix('signals')} />
        <FlowPanel flow={data.flow} onFix={() => fix(data.flow.fixRoute)} />
      </div>

      <BlindSpotsFold blindSpots={data.blindSpots} onFix={fix} />

      <ScoreExplainFold scoreExplain={data.scoreExplain} />

      <RecommendationPanel recommendation={data.recommendation} onOpenCase={openCase} />

      {caseNote && (
        <p className="dv-why" role="status">
          {caseNote}
        </p>
      )}

      {data.sources.length > 0 && (
        <p className="dv-src">
          Every figure above is read from:{' '}
          {data.sources
            .map((source) =>
              source.files.length > 0
                ? `${source.label} (${source.files.join(', ')})`
                : source.label,
            )
            .join(' · ')}
        </p>
      )}
    </div>
  );
}
