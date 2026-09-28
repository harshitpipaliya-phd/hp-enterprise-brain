import React from 'react';

import { Spinner } from '../../ui';
import CapabilityPage from './CapabilityPage';
import ConsolePage from './ConsolePage';
import { ConsoleNavProvider, parseConsoleRoute, type ConsoleNav } from './consoleNav';
import './aiIntelligence.css';

/*
  The managed screens, one chunk each — the same split G2G gets from one Next
  route per screen. Everything not listed here is a registry-described capability
  and renders CapabilityPage.
*/
const ProvidersScreen = React.lazy(() => import('./screens/ProvidersScreen'));
const ModelsScreen = React.lazy(() => import('./screens/ModelsScreen'));
const TemplateListScreen = React.lazy(() => import('./screens/prompts/TemplateListScreen'));
const TemplateNewScreen = React.lazy(() => import('./screens/prompts/TemplateNewScreen'));
const TemplateViewScreen = React.lazy(() => import('./screens/prompts/TemplateViewScreen'));
const TemplateEditScreen = React.lazy(() => import('./screens/prompts/TemplateEditScreen'));
const PoliciesScreen = React.lazy(() => import('./screens/PoliciesScreen'));
const ConversationalScreen = React.lazy(() => import('./screens/ConversationalScreen'));
const RecommendationsScreen = React.lazy(() => import('./screens/RecommendationsScreen'));
const EvaluationScreen = React.lazy(() => import('./screens/EvaluationScreen'));
const UsageCostScreen = React.lazy(() => import('./screens/UsageCostScreen'));

export interface AiIntelligenceAppProps {
  /** The console sub-route: '' for the index, 'providers', 'prompts/12/edit', … */
  route: string;
  onRoute: (route: string) => void;
  /** Leave the console for another HP Brain view (e.g. 'agents'). */
  onOpenView: (view: string) => void;
}

/**
 * HP Brain's AI & Intelligence console: G2G's /ai tree as one view.
 *
 * Reached from the account menu, not the sidebar — the same placement G2G uses,
 * for the same reason: these are administration screens that configure the AI
 * every module then uses, not a module of their own. The server gates every route
 * behind settings.manage; hiding the entry is the courtesy, the middleware is the
 * control.
 */
export default function AiIntelligenceApp({ route, onRoute, onOpenView }: AiIntelligenceAppProps) {
  const parsed = React.useMemo(() => parseConsoleRoute(route), [route]);

  const nav = React.useMemo<ConsoleNav>(() => ({
    route: parsed,
    go: (next) => {
      onRoute(next);
      window.scrollTo?.({ top: 0 });
    },
    openView: onOpenView,
  }), [parsed, onRoute, onOpenView]);

  return (
    <ConsoleNavProvider value={nav}>
      <React.Suspense fallback={<div className="aii-page"><Spinner label="Loading AI & Intelligence" /></div>}>
        {renderRoute(parsed.segments, parsed.query)}
      </React.Suspense>
    </ConsoleNavProvider>
  );
}

function renderRoute(segments: string[], query: Record<string, string>): React.ReactNode {
  const [head, second, third] = segments;

  switch (head) {
    case undefined:
      return <ConsolePage />;
    case 'providers':
      return <ProvidersScreen />;
    case 'models':
      return <ModelsScreen />;
    case 'prompts':
      if (!second) return <TemplateListScreen initialModule={query.module} />;
      if (second === 'new') return <TemplateNewScreen initialModule={query.module} />;
      if (third === 'edit') return <TemplateEditScreen id={second} />;
      return <TemplateViewScreen id={second} />;
    case 'policies':
      return <PoliciesScreen />;
    case 'conversational-ai':
      return <ConversationalScreen />;
    case 'recommendations':
      return <RecommendationsScreen />;
    case 'evaluation':
      return <EvaluationScreen />;
    case 'usage-cost':
      return <UsageCostScreen />;
    default:
      return <CapabilityPage slug={head} />;
  }
}
