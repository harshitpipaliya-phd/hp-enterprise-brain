import { ArrowRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { StatusBadge, type BadgeTone } from './primitives';

/**
 * The standard card for a piece of intelligence: a finding, a risk, a
 * recommendation — anything the Brain has an opinion about and a status for.
 *
 * NOT A NEW STYLING SYSTEM. The geometry is lifted from the card already in
 * ExecutiveDashboard.tsx:93 (12px padding, 8px radius, 1px border, 4px status
 * border-left), surfaces come from useTheme() exactly as the other 20 screens
 * read them, and status hues come from the design tokens rather than hex.
 *
 * WHY THE HUES ARE TOKENS AND NOT LITERALS. CommandCenter's header records that
 * its previous version hardcoded '#22c55e', '#f59e0b' and '#ef4444', which made
 * that screen ignore the theme it was mounted in and drift from every other
 * screen. ExecutiveDashboard.tsx:119-127 still does exactly that. Reading
 * var(--status-*) instead is what keeps this component following a palette
 * change; the second argument to var() is only a jsdom fallback, because
 * getComputedStyle does not resolve custom properties there.
 *
 * STATUS IS NEVER COLOUR ALONE. The border hue is decorative; the meaning is
 * carried by the badge, which renders a word AND a glyph via StatusBadge. That
 * is the rule the design system already enforces, and it is why this file
 * reuses StatusBadge rather than drawing its own pill — a second badge
 * implementation is a second thing to keep in step with the token set.
 */

export type IntelligenceStatus = 'critical' | 'at-risk' | 'watch' | 'healthy';

interface StatusSpec {
  /** Word shown in the badge. Uppercase is the visual spec, not shouting. */
  label: string;
  /** The 4px left border. Decorative — never the sole carrier of meaning. */
  accent: string;
  /** Reuses the existing badge tones, so this card matches every other badge. */
  tone: BadgeTone;
}

/**
 * ONE map drives both the border and the badge, so the two can never disagree.
 *
 * TWO PLACES WHERE THE PROTOTYPE AND THE TOKEN SET DO NOT LINE UP — both
 * resolved here, deliberately, and both are a one-line change if you want the
 * other answer:
 *
 *   healthy → the prototype says teal. The design system's success colour is
 *     --status-good, which is GREEN in the dark theme and GOLD in the warm one,
 *     never teal. Teal is --accent-intelligence. Using it means a healthy card
 *     and a success badge elsewhere on the same screen are different hues. The
 *     prototype is honoured for the border; the badge stays tone="success" so
 *     it agrees with the rest of the app. Swap accent to var(--status-good) if
 *     you would rather the card match the badge than the prototype.
 *
 *   watch → the prototype says yellow. There is no yellow ramp; the palette is
 *     ink, gold and teal, and gold IS the product's yellow
 *     (--accent-evidence / gold-300). Note that gold and amber sit close
 *     together, so 'AT RISK' and 'WATCH' are distinguishable mainly by their
 *     words and glyphs rather than by hue — which is the reason the badge
 *     carries both.
 */
const STATUS: Record<IntelligenceStatus, StatusSpec> = {
  critical:  { label: 'CRITICAL', accent: 'var(--status-crit, #E5484D)',          tone: 'danger'  },
  'at-risk': { label: 'AT RISK',  accent: 'var(--status-warn, #EBB454)',          tone: 'warning' },
  watch:     { label: 'WATCH',    accent: 'var(--accent-evidence, #F2CC82)',      tone: 'gold'    },
  healthy:   { label: 'HEALTHY',  accent: 'var(--accent-intelligence, #33D6C6)',  tone: 'success' },
};

export interface IntelligenceCardProps {
  status: IntelligenceStatus;
  title: string;
  /** One line. Long text is clamped rather than wrapped — cards stay a grid. */
  description?: string;
  /**
   * 0..1.
   *
   * `undefined` and `null` MEAN DIFFERENT THINGS and are rendered differently.
   * undefined — this kind of card does not carry a confidence; the segment is
   * omitted. null — confidence was looked for and is not known; it renders as
   * an explicit dash. A null confidence is not a confidence of zero, and a
   * component that quietly prints ".00" for one turns "never assessed" into
   * "assessed as worthless" — the same defect SnapshotWriter's docblock
   * describes for a null metric drawn as a flat line at the bottom of a chart.
   */
  confidence?: number | null;
  /** How the confidence was arrived at: 'demonstrated', 'inferred', 'stated'. */
  basis?: string;
  /**
   * Extra metadata segments, joined with the middot separator.
   *
   * ReactNode, not string, so a caller can emphasise ONE segment without
   * styling the whole row. KasbaExplorer needs exactly that: its "· 2 unknown"
   * is rendered in the critical hue on purpose, because an unknown assessment
   * is the thing a reader must not skim past. Flattening it to plain text would
   * quietly downgrade a data-quality warning to a footnote.
   */
  meta?: React.ReactNode[];
  /**
   * A domain badge shown beside the status badge.
   *
   * The status badge states the card's OWN verdict. Some domains carry a second,
   * orthogonal axis that must stay visible next to it — KASBA's capability
   * state ("how firmly do we know this") against its level ("how good"), where
   * showing the level alone is what lets a self-assertion read as a
   * measurement. One slot cannot hold both, and collapsing them would pick a
   * winner between two questions that are not the same question.
   */
  badge?: React.ReactNode;
  /** Omitted entirely when 0 — an empty action affordance invites a dead click. */
  actionCount?: number;
  /** Singular noun; pluralised by adding -s, matching the terminology rule. */
  actionNoun?: string;
  /** Makes the whole card activatable. Renders a <button> when provided. */
  onClick?: () => void;
}

/** `.78`, the prototype's format — leading zero dropped, always 2 decimals. */
function formatConfidence(value: number): string {
  return value.toFixed(2).replace(/^0(?=\.)/, '');
}

export function IntelligenceCard({
  status,
  title,
  description,
  confidence,
  basis,
  meta = [],
  badge,
  actionCount = 0,
  actionNoun = 'action',
  onClick,
}: IntelligenceCardProps) {
  const theme = useTheme();
  const spec = STATUS[status];

  const segments: React.ReactNode[] = [];

  if (confidence === null) {
    segments.push('confidence —');
  } else if (confidence !== undefined) {
    segments.push(`confidence ${formatConfidence(confidence)}`);
  }

  if (basis) segments.push(basis);
  segments.push(...meta);

  const interactive = typeof onClick === 'function';

  /*
    A clickable card is a <button>, not a <div onClick>.
    useTheme()'s own docblock notes that inline style objects cannot express
    hover or focus, so a div would be silently unreachable by keyboard and would
    show no focus ring. The element type supplies both for free, and
    `textAlign: left` undoes the only button default that fights this layout.
  */
  const Element = interactive ? 'button' : 'div';

  return (
    <Element
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      style={{
        // Geometry copied from ExecutiveDashboard.tsx:93 so a screen mixing
        // this card with the existing ones does not show two card shapes.
        padding: 12,
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        borderLeft: `4px solid ${spec.accent}`,
        backgroundColor: theme.surface,
        color: theme.text,

        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      {/* Title + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: theme.text, lineHeight: 1.35 }}>
          {title}
        </span>
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {badge}
          <StatusBadge tone={spec.tone}>{spec.label}</StatusBadge>
        </span>
      </div>

      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.45,
            color: theme.textMuted,
            // Clamped, not wrapped: the spec calls for one line, and a card that
            // grows with its text breaks the alignment of every card beside it.
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={description}
        >
          {description}
        </p>
      )}

      {/* Metadata row + action count. Baseline-aligned so the arrow sits on the
          text, and marginTop:auto pins it to the bottom when cards are stretched
          to equal height in a grid. */}
      {(segments.length > 0 || actionCount > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 'auto',
            paddingTop: 2,
          }}
        >
          {/* Rendered as nodes with explicit separators rather than
              segments.join(' · '), which would stringify a coloured <span> to
              "[object Object]". */}
          <span style={{ fontSize: 11, color: theme.textMuted, letterSpacing: 0.2 }}>
            {segments.map((segment, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {segment}
              </span>
            ))}
          </span>

          {actionCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 600,
                // The one place the status hue is reused as text: it reads as
                // the card's own call to action rather than as a second status.
                color: spec.accent,
              }}
            >
              {actionCount} {actionNoun}{actionCount === 1 ? '' : 's'}
              <ArrowRight aria-hidden="true" style={{ width: 12, height: 12 }} />
            </span>
          )}
        </div>
      )}
    </Element>
  );
}
