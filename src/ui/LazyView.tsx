import React from 'react';
import { Button, Skeleton } from './primitives';

/**
 * A code-split screen that can actually recover from a failed download.
 *
 * WHY NOT JUST React.lazy + <Suspense> + the existing ErrorBoundary.
 * React.lazy memoises the promise on the lazy component object itself,
 * including a REJECTED one. So when a chunk request fails — a deploy that
 * replaced the file mid-session, a flaky connection, a proxy hiccup — an error
 * boundary whose "Retry" only clears its own state re-renders the same lazy
 * object, React hands back the same rejected promise, and the retry fails
 * instantly and forever. The button looks like a way out and is not one.
 *
 * The fix is to build a NEW lazy component per attempt, which issues a fresh
 * import(). Browsers do not cache a failed module request, so the second
 * attempt really does go back to the network.
 *
 * The Suspense boundary is placed by the CALLER around the content region only,
 * never around the shell — the sidebar and header must stay interactive while a
 * screen downloads.
 */

interface ChunkErrorBoundaryProps {
  label: string;
  onRetry: () => void;
  children: React.ReactNode;
}

interface ChunkErrorBoundaryState {
  error: Error | null;
}

class ChunkErrorBoundary extends React.Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ChunkErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[LazyView] failed to load screen', error, info.componentStack);
  }

  private handleRetry = () => {
    // Clear the caught error FIRST, then ask the host for a fresh import. In
    // the other order this boundary re-renders the failed child before the new
    // lazy component exists and catches the same error again.
    this.setState({ error: null }, this.props.onRetry);
  };

  render(): React.ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="u-state u-state-danger" role="alert">
        <h3 className="u-state-title">Couldn’t load {this.props.label}</h3>
        <p className="u-state-desc">
          The screen’s code failed to download. This is usually a connection problem, or the app
          having been updated since this tab was opened.
        </p>
        <Button variant="secondary" onClick={this.handleRetry}>Try again</Button>
      </div>
    );
  }
}

/**
 * Placeholder shown while a screen downloads.
 *
 * Shaped like a page — header block, then cards — rather than a centred
 * spinner, so the content lands in roughly the space already reserved for it
 * instead of shifting the layout when it arrives.
 */
export function ViewSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eb-space-5)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--eb-space-2)' }}>
        <Skeleton width={260} height={26} radius={6} />
        <Skeleton width={420} height={14} radius={4} />
      </div>
      <div className="u-grid u-grid-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width="100%" height={104} radius={16} />)}
      </div>
      <Skeleton width="100%" height={280} radius={16} />
    </div>
  );
}

export interface LazyViewProps<P> {
  /** Names the screen in the failure message. */
  label: string;
  loader: () => Promise<{ default: React.ComponentType<P> }>;
  props: P;
}

export function LazyView<P extends object>({ label, loader, props }: LazyViewProps<P>) {
  const [attempt, setAttempt] = React.useState(0);

  // Rebuilt per attempt — that is the whole point. Recreating the lazy
  // component is what issues a new import(); reusing it would replay the
  // cached rejection.
  const Component = React.useMemo(
    () => React.lazy(loader),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt],
  );

  return (
    <ChunkErrorBoundary
      key={attempt}
      label={label}
      onRetry={() => setAttempt((n) => n + 1)}
    >
      <React.Suspense fallback={<ViewSkeleton />}>
        {/* createElement rather than a JSX spread: TypeScript cannot prove a
            bare generic `P` satisfies IntrinsicAttributes when spread into
            JSX, but it types this call precisely. */}
        {React.createElement(Component as unknown as React.ComponentType<P>, props)}
      </React.Suspense>
    </ChunkErrorBoundary>
  );
}
