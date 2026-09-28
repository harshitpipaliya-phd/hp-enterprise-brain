import React from 'react';
import { ArrowUpRight } from 'lucide-react';

import { Button } from '../../ui';
import { getCapabilityBySlug } from './core';
import { CapabilityLiveData } from './CapabilityLiveData';
import { BackLink, StatusChip } from './console-ui';
import { useConsoleNav } from './consoleNav';

/**
 * The capability page's frame — G2G's CapabilityShell.
 *
 * The managed capabilities (providers, models, prompts, policies, …) and the
 * generic capability page render this same shell and differ only in what they put
 * inside it, so the header, back link, status chip and live-data panel cannot
 * drift across twelve capabilities.
 */
export function CapabilityShell({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const { go, openView } = useConsoleNav();
  const capability = getCapabilityBySlug(slug);
  if (!capability) return null;

  return (
    <div className="aii-page">
      <BackLink onClick={() => go('')} />

      <header className="aii-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="aii-title">{capability.name}</h1>
          <p className="aii-lead">{capability.purpose}</p>
        </div>
        <StatusChip status={capability.status} />
      </header>

      {/* A capability whose working screen is elsewhere in HP Brain says so at the
          top. Burying the link under the data would make a live feature look like
          a description. */}
      {capability.openView && (
        <div>
          <Button variant="secondary" onClick={() => openView(capability.openView!)}>
            Open {capability.name}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* Live records lead — what the capability holds for this organisation is
          what an administrator opened the screen for. */}
      <CapabilityLiveData slug={capability.slug} name={capability.name} />

      {children}
    </div>
  );
}
