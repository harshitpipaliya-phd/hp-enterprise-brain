import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/**
 * A render error anywhere below this point unmounts React's whole tree and
 * leaves the page blank — no message, nothing in the UI to act on. That is what
 * "every department opens to a white screen" actually was: DepartmentIntelligence
 * read twin.capabilityHeatmap.length on a response that had no such field, and
 * the resulting TypeError took the entire application down with it.
 *
 * The underlying shape mismatch is fixed in the controller. This boundary is
 * here so the NEXT one is legible: the failing screen is replaced with the error
 * and its component stack, the rest of the shell (sidebar, navigation) stays
 * usable, and the user can get back to a working screen without a hard reload.
 */
interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which screen failed. */
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept on the console too: the stack is the fastest route to the field
    // whose absence caused this, and the fallback below only shows a slice.
    console.error('[ErrorBoundary] render failed', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private reset = () => this.setState({ error: null, componentStack: null });

  render(): ReactNode {
    const { error, componentStack } = this.state;

    if (!error) return this.props.children;

    return (
      <div
        style={{
          border: '1px solid var(--feedback-error-border, var(--status-crit))',
          background: 'var(--feedback-error-surface)',
          borderRadius: 12,
          padding: '18px 20px',
          maxWidth: 900,
          margin: '24px auto',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
          {this.props.label ? `The ${this.props.label} screen failed to render.` : 'This screen failed to render.'}
        </div>
        <div style={{ fontSize: 13.5, marginBottom: 12, color: 'var(--content-secondary, #666)' }}>
          The rest of the app is still working — pick another screen from the sidebar, or retry.
        </div>
        <pre
          style={{
            fontFamily: 'var(--mono, monospace)',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: 'var(--surface-inset, rgba(0,0,0,.04))',
            borderRadius: 8,
            padding: 12,
            margin: '0 0 12px',
            maxHeight: 260,
            overflow: 'auto',
          }}
        >
          {error.message}
          {componentStack ? `\n${componentStack.trim().split('\n').slice(0, 8).join('\n')}` : ''}
        </pre>
        <button onClick={this.reset}>Retry</button>
      </div>
    );
  }
}

export default ErrorBoundary;
