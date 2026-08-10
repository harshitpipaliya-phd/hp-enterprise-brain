/**
 * App-wide busy state. API modules can update it without importing React, and
 * the shell subscribes once to render a single consistent loader.
 */
let activeRequests = 0;
let navigationPending = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const globalLoading = {
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  snapshot: () => activeRequests > 0 || navigationPending,
  requestStarted() { activeRequests += 1; emit(); },
  requestFinished() { activeRequests = Math.max(0, activeRequests - 1); emit(); },
  navigationStarted() { navigationPending = true; emit(); },
  navigationFinished() { navigationPending = false; emit(); },
};
