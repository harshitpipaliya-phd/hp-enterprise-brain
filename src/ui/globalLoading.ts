/**
 * App-wide busy state. The global overlay should appear only for:
 * - real page navigation / refresh-driven data loading
 * - meaningful mutating actions while the request is in flight
 *
 * Passive reads, polling and tiny background activity should not light up the
 * whole screen.
 */

let pageRequests = 0;
let mutationRequests = 0;
let navigationPending = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export type GlobalLoaderMode = 'none' | 'page' | 'mutation';

export const globalLoading = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  snapshot: () => pageRequests > 0 || mutationRequests > 0 || navigationPending,
  requestStarted(mode: GlobalLoaderMode) {
    if (mode === 'page') pageRequests += 1;
    if (mode === 'mutation') mutationRequests += 1;
    if (mode !== 'none') emit();
  },
  requestFinished(mode: GlobalLoaderMode) {
    if (mode === 'page') pageRequests = Math.max(0, pageRequests - 1);
    if (mode === 'mutation') mutationRequests = Math.max(0, mutationRequests - 1);
    if (mode !== 'none') emit();
  },
  navigationStarted() {
    navigationPending = true;
    emit();
  },
  navigationFinished() {
    navigationPending = false;
    emit();
  },
  isNavigationPending() {
    return navigationPending;
  },
};
