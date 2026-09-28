/**
 * Hosts one module's AI Stack inside an HP Brain screen — the nine shared tabs,
 * switchable. Ported from G2G's components/ai-stack/ai-stack-host.tsx.
 *
 * Same tab strip (icon, label, active dot) and the same rule that only the open tab
 * renders. G2G remembers the tab in the URL (`?aiTab=`); HP Brain has no router, so it
 * is remembered per module for the browser session instead — returning to a module's
 * AI Stack lands on the tab that was open.
 *
 * The screens themselves come from `buildAiStackScreens(module)` unchanged.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { buildAiStackScreens } from './build-ai-stack-screens';
import type { AiStackModule } from './ai-stack-module';
import './aiStack.css';

/** One in-page screen. The same type as LMS_K12's and G2G's `ModuleStaticScreen`. */
export type ModuleStaticScreen = {
  id: string;
  label: string;
  icon?: LucideIcon;
  render: () => ReactNode;
};

const storageKey = (moduleKey: string) => `hpbrain.aiStack.tab.${moduleKey}`;

function readStoredTab(moduleKey: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(moduleKey));
  } catch {
    return null;
  }
}

export function AiStackTabs({ module }: { module: AiStackModule }) {
  const tabs = useMemo(() => buildAiStackScreens(module), [module]);
  const [requested, setRequested] = useState<string | null>(() => readStoredTab(module.key));
  const activeTab = tabs.find((tab) => tab.id === requested) ?? tabs[0] ?? null;

  const selectTab = useCallback(
    (tab: ModuleStaticScreen) => {
      setRequested(tab.id);
      try {
        sessionStorage.setItem(storageKey(module.key), tab.id);
      } catch {
        // Private mode or blocked storage: the tab still switches, it just is not remembered.
      }
    },
    [module.key],
  );

  return (
    <div className="ais-host">
      <div className="ais-tabs" role="tablist" aria-label={`${module.label} AI Stack`}>
        {tabs.map((tab) => {
          const isActive = activeTab?.id === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ais-tab${isActive ? ' ais-tab--active' : ''}`}
              onClick={() => selectTab(tab)}
            >
              {Icon ? <Icon size={16} aria-hidden="true" /> : null}
              {tab.label}
              {Icon && isActive ? <span className="ais-tab-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {activeTab ? <div key={activeTab.id} role="tabpanel">{activeTab.render()}</div> : null}
    </div>
  );
}
