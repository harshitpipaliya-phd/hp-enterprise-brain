
import { ArrowLeft, LayoutGrid } from 'lucide-react';

import { Button } from '../../ui';
import { getCapabilityBySlug } from './core';
import { CapabilityShell } from './CapabilityShell';
import { PointList, SectionCard } from './console-ui';
import { useConsoleNav } from './consoleNav';

/**
 * One AI capability, described from the shared registry and filled from HP Brain's
 * own data — G2G's app/ai/[capability]/page.tsx.
 *
 * Leads with what the capability holds for the signed-in organisation, then the
 * registry record. The capabilities with management screens of their own are routed
 * ahead of this page by AiIntelligenceApp, so this serves the rest.
 */
export default function CapabilityPage({ slug }: { slug: string }) {
  const capability = getCapabilityBySlug(slug);
  if (!capability) return <UnknownCapability slug={slug} />;

  return (
    <CapabilityShell slug={capability.slug}>
      <div className="aii-grid-2">
        <SectionCard title="Where this stands today" description={capability.todayHere} />
        <SectionCard title="Why it is one shared service" description={capability.whyCentral} />
        <SectionCard title="What is left to do">
          <PointList points={capability.toCentralise} />
        </SectionCard>
        <SectionCard title="What the platform gains">
          <PointList points={capability.afterCentralisation} />
        </SectionCard>
      </div>
    </CapabilityShell>
  );
}

/**
 * A slug the registry does not know. Says which name failed — a renamed capability
 * leaves bookmarks behind, and the person following one needs to know that.
 */
export function UnknownCapability({ slug }: { slug?: string }) {
  const { go } = useConsoleNav();
  return (
    <div className="aii-page" style={{ alignItems: 'center', paddingBlock: 'var(--space-10)' }}>
      <div className="aii-card" style={{ maxWidth: 440, textAlign: 'center', borderStyle: 'dashed' }}>
        <LayoutGrid size={20} aria-hidden="true" className="aii-muted" />
        <h1 className="aii-title" style={{ fontSize: 18, marginTop: 'var(--space-3)' }}>No such AI capability</h1>
        <p className="aii-lead">
          {slug ? `"${slug}" is not in the AI capability registry.` : 'No capability was named.'} It may have been renamed.
        </p>
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Button variant="secondary" onClick={() => go('')} icon={<ArrowLeft size={16} aria-hidden="true" />}>
            All AI capabilities
          </Button>
        </div>
      </div>
    </div>
  );
}
