import { Bar, NotMeasurable, Panel, Pill } from '../../intelligence/parts';
import type { Capabilities } from '../../../api/departmentIntelligence';

/**
 * WHAT THIS UNIT IS EXPECTED TO BE ABLE TO DO.
 *
 * COVERAGE IS ASSESSED-OVER-EXPECTED, and both halves are printed. A unit with
 * five expected capabilities and one assessment is 20% covered; a unit with no
 * expected capabilities is not 0% covered, it is UNMEASURED, and the two render
 * differently — the second as an empty state with the fix, never as an empty bar
 * that reads as failure.
 *
 * SEEDED ASSESSMENTS ARE LABELLED. Some of this data was written by a demo
 * seeder rather than observed in this organization. Presenting it silently
 * beside real findings would be the most damaging kind of false confidence,
 * because it is indistinguishable from the real thing until someone acts on it.
 */
export function CapabilityPanel({
  capabilities,
  onFix,
}: {
  capabilities: Capabilities;
  onFix?: () => void;
}) {
  if (!capabilities.supported) {
    return (
      <Panel title="Capabilities">
        <NotMeasurable
          what="Capability coverage"
          reason={capabilities.reason ?? 'Nothing records what this unit is expected to be able to do.'}
          fixLabel="Assign capabilities"
          onFix={onFix}
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Capabilities"
      sub={capabilities.caption}
      footer={capabilities.note}
    >
      <div>
        {capabilities.items.map((item) => {
          const share = item.level === null ? null : (item.level / item.levelOf) * 100;

          return (
            <div className="dv-cap" key={item.name}>
              <div>
                <div className="dv-cap__n">{item.name}</div>
                <div className="dv-cap__w">
                  {item.reason
                    ?? [item.category, item.state, item.seeded ? 'seeded demo assessment' : null]
                      .filter(Boolean)
                      .join(' · ')}
                </div>
              </div>

              {item.level === null ? (
                <Pill tone="neutral">Never assessed</Pill>
              ) : (
                <Pill tone={share! >= 70 ? 'good' : share! >= 40 ? 'warn' : 'crit'}>
                  {item.level.toFixed(1)} of {item.levelOf}
                </Pill>
              )}

              {share === null ? (
                <span className="dv-cap__w">no level recorded</span>
              ) : (
                <Bar
                  pct={share}
                  tone={share >= 70 ? 'good' : share >= 40 ? 'warn' : 'crit'}
                  label={`${item.name}: assessed at ${item.level} out of ${item.levelOf}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
