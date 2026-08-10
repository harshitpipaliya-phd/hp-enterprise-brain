/**
 * The pieces Signup and Login share.
 *
 * Extracted rather than duplicated because the brief is that the two screens
 * must read as one product. Two copies of a brand lockup drift — one gets a new
 * tagline, the other keeps the old one, and the family resemblance quietly
 * stops being true. Anything visual that both screens show lives here; anything
 * either one shows alone stays in its own file.
 */

/** Ambient background field. Purely decorative, so it is hidden from AT. */
export function AuthBackdrop() {
  return (
    <div className="eb-auth-bg" aria-hidden="true">
      <span className="eb-auth-glow eb-auth-glow-1" />
      <span className="eb-auth-glow eb-auth-glow-2" />
      <div className="eb-auth-mesh" />
    </div>
  );
}

/** The Enterprise Brain mark. `tone` picks the light or dark context. */
export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <div className={tone === 'light' ? 'eb-auth-solo-brand' : 'eb-auth-brand'}>
      <div className="eb-auth-logo" aria-hidden="true">HP</div>
      <div>
        <h1>Enterprise Brain</h1>
        <p>Organizational Intelligence Platform</p>
      </div>
    </div>
  );
}

export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6m0 3.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * What the product actually does, as five steps.
 *
 * Organization → Your data → Signals → Evidence → Intelligence. Every one of
 * those is a real screen in the app the user is about to enter, so this is a
 * map rather than a marketing graphic — which is the reason it earns the space
 * a decorative illustration would not.
 *
 * Built from a list and CSS rather than an SVG: the labels are text, so they
 * stay legible at any size, reflow on a narrow screen, and are selectable. The
 * only motion is a single gold pulse travelling down the rail, and it stops
 * under prefers-reduced-motion.
 */
interface FlowStep {
  label: string;
  note: string;
  /** The payoff step, styled as the end of the chain. */
  terminal?: boolean;
}

const FLOW: readonly FlowStep[] = [
  { label: 'Organization', note: 'Your structure, people and units' },
  { label: 'Your data', note: 'Spreadsheets, ERP exports, systems' },
  { label: 'Signals', note: 'What changed, and where it matters' },
  { label: 'Evidence', note: 'Why the Brain believes it' },
  { label: 'Intelligence', note: 'Decisions you can act on', terminal: true },
];

export function IntelligenceFlow() {
  return (
    <ol className="eb-auth-flow">
      {FLOW.map((step, i) => (
        <li key={step.label} data-terminal={step.terminal ? 'true' : undefined}>
          <span className="eb-auth-flow-marker" aria-hidden="true">
            <span className="eb-auth-flow-dot" style={{ animationDelay: `${i * 0.45}s` }} />
          </span>
          <span className="eb-auth-flow-body">
            <strong>{step.label}</strong>
            <em>{step.note}</em>
          </span>
        </li>
      ))}
    </ol>
  );
}
