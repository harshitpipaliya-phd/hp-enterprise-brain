import { useSyncExternalStore } from 'react';
import { globalLoading } from './globalLoading';
import './globalLoader.css';

/** The single visual loading surface for navigation and every API request. */
export function GlobalLoader() {
  const mode = useSyncExternalStore(globalLoading.subscribe, globalLoading.mode, () => 'none');
  if (mode === 'none') return null;

  if (mode === 'mutation') {
    return (
      <div className="global-loader global-loader-compact" role="status" aria-live="polite" aria-label="Saving changes">
        <div className="global-loader__chip">
          <div className="global-loader__brand" aria-hidden="true">HP</div>
          <div className="global-loader__copy">
            <strong>Saving changes</strong>
            <span>Updating the workspace…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="global-loader" role="status" aria-live="polite" aria-label="Loading workspace">
      <div className="global-loader__panel">
        <div className="global-loader__brand" aria-hidden="true">HP</div>
        <div className="global-loader__copy">
          <strong>Loading workspace</strong>
          <span>Refreshing navigation and live intelligence surfaces…</span>
        </div>
        <div className="global-loader__skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
