import { Panel } from '../../intelligence/parts';
import type { DepartmentState } from '../../../api/departmentIntelligence';

/**
 * WHAT THIS UNIT'S RECORDS SAY, AND WHAT IS LEFT TO DO.
 *
 * THE PROSE IS GENERATED FROM THE FIGURES, NOT WRITTEN FOR THEM. Every sentence
 * arrives from the server naming the number it came from, so the reader can
 * check each clause against a panel further down the page. Nothing here is
 * written by a language model and nothing is a template with the good news
 * filled in.
 *
 * A TASK EXISTS BECAUSE A MEASUREMENT PRODUCED IT. Each one carries the
 * measurement as its reason — "50 of 109 open items are older than 14 days", not
 * "improve responsiveness" — because a task whose evidence is not on the page is
 * an opinion the reader cannot check.
 */
export function DepartmentStatePanel({ state }: { state: DepartmentState }) {
  return (
    <Panel>
      <p className="dv-summary">{state.summary}</p>

      {state.tasks.length === 0 ? (
        <p className="dv-why">
          No task is outstanding that this model can measure. That is a statement about what is
          recorded, not a guarantee that there is nothing to do.
        </p>
      ) : (
        <div>
          {state.tasks.map((task) => (
            <div className={`dv-task${task.status === 'done' ? ' dv-task--done' : ''}`} key={task.title}>
              <span className="dv-tick" data-status={task.status} aria-hidden="true">
                {task.status === 'done' ? '✓' : '!'}
              </span>
              <div>
                {/* The status is in the text for a screen reader, not only in the
                    strike-through and the tick's colour. */}
                <span className="u-sr-only">{task.status === 'done' ? 'Done: ' : 'To do: '}</span>
                <span className="dv-task__t">{task.title}</span>
                <div className="dv-task__m">{task.meta}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
