import { useSyncExternalStore } from 'react';
import { globalLoading } from './globalLoading';
import './globalLoader.css';

/** The single visual loading surface for navigation and every API request. */
export function GlobalLoader() {
  const busy = useSyncExternalStore(globalLoading.subscribe, globalLoading.snapshot, () => false);
  if (!busy) return null;
  return <div className="global-loader" role="status" aria-live="polite" aria-label="Loading">
    <div className="global-loader__brand" aria-hidden="true">HP</div>
  </div>;
}
