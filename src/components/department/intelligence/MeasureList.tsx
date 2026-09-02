import { MeasureRow, Panel } from '../../intelligence/parts';
import type { Measure, Tone } from '../../../api/departmentIntelligence';

/**
 * A PANEL OF MEASURES — performance, workload, anything shaped the same.
 *
 * THE TONE IS DECIDED HERE, THE VALUE NEVER IS. The server sends the number and
 * the sentence; this decides only whether the reader should be worried about it,
 * from thresholds that are about READING a figure rather than computing one.
 * Every threshold below is named and one-directional, so a reader who disagrees
 * can see exactly what they are disagreeing with.
 *
 * A measure with no value renders as its reason and is given no tone at all,
 * because "unknown" is not a shade of good or bad.
 */

/**
 * Which way is up for each measure, and where the bands sit.
 *
 * Keyed on the server's `key`, so a measure this table does not know about
 * renders neutral rather than picking up a colour by accident.
 */
const TONE_RULES: Record<string, (value: number) => Tone> = {
  // Higher is better.
  completion: (v) => (v >= 0.85 ? 'good' : v >= 0.6 ? 'warn' : 'crit'),

  // Lower is better: work that ended without a result, and subjects that had to
  // come back. Both are counted as shares of classified work.
  cancellation: (v) => (v <= 0.05 ? 'good' : v <= 0.15 ? 'warn' : 'crit'),
  repeat: (v) => (v <= 0.1 ? 'good' : v <= 0.25 ? 'warn' : 'crit'),

  // Days to close. A week is the same boundary the service dimension scores on.
  turnaround: (v) => (v <= 3 ? 'good' : v <= 7 ? 'warn' : 'crit'),

  // Share of open work that has been open past the aging threshold.
  aged: (v) => (v <= 0.1 ? 'good' : v <= 0.3 ? 'warn' : 'crit'),
};

export function MeasureList({
  title,
  sub,
  measures,
  footer,
}: {
  title: string;
  sub?: string | null;
  measures: Measure[];
  footer?: string | null;
}) {
  return (
    <Panel title={title} sub={sub} footer={footer}>
      <div>
        {measures.map((measure) => (
          <MeasureRow
            key={measure.key}
            label={measure.label}
            value={measure.value}
            format={measure.format}
            hint={measure.hint}
            source={measure.source}
            tone={measure.value === null ? 'neutral' : TONE_RULES[measure.key]?.(measure.value) ?? 'neutral'}
            showBar={measure.format === 'rate' || measure.format === 'percent'}
          />
        ))}
      </div>
    </Panel>
  );
}
