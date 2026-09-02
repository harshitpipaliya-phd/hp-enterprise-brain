import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../ui';
import { Bar, Panel, initials } from '../../intelligence/parts';
import type { People } from '../../../api/departmentIntelligence';

/**
 * THE ROSTER, ONE PAGE AT A TIME.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * PAGED ON THE SERVER
 *
 * `?page=&pageSize=` cuts the list in the query, not in the browser. A unit of
 * 770 people is a real shape on this data, and a screen that downloads all of
 * them to show five is a screen that stops working on the largest unit — which
 * is the one most worth looking at.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * NOBODY IS GRADED HERE, AND THE FOOTNOTE SAYS WHY
 *
 * This roster records no role for anyone, so a trainee and a supervisor are
 * indistinguishable. Ordering by volume and calling the top of the list the best
 * performers would be comparing two different jobs and presenting the result as
 * a judgement about people. Volume is shown as volume; the server states the
 * sort order and the reason no verdict is published, and both are printed.
 *
 * A PERSON THE IMPORTS NEVER NAME SHOWS "not linked", NOT 0. "Handled nothing"
 * and "is not named by any import" are opposite findings about an employee, and
 * only one of them is about their work.
 */
export function PeopleRoster({
  people,
  loading,
  onPage,
  onOpenPerson,
}: {
  people: People;
  loading: boolean;
  onPage: (page: number) => void;
  onOpenPerson?: (personId: string) => void;
}) {
  const showPresence = people.items.some((p) => p.presenceRate !== null);

  return (
    <Panel
      footer={
        <>
          {people.sort} {people.verdictNote}
          {people.presenceMethod && ` Presence: ${people.presenceMethod}`}
        </>
      }
    >
      <div className="dv-people__head">
        <h3>People in this department</h3>
        <span className="dv-panel__sub">
          {people.total === 0
            ? 'Nobody is assigned to this unit in the source system.'
            : `Showing ${people.from}–${people.to} of ${people.total.toLocaleString()}`}
          {people.total > 0 && ` · ${people.linkedTotal} named by an import`}
        </span>

        <div className="dv-pager">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft size={14} aria-hidden="true" />}
            disabled={people.page <= 1 || loading}
            onClick={() => onPage(people.page - 1)}
          >
            Prev
          </Button>
          <span>
            Page {people.page} of {people.pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={people.page >= people.pages || loading}
            onClick={() => onPage(people.page + 1)}
          >
            Next <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* aria-busy rather than replacing the list: the rows keep their height
          while the next page loads, so the pager does not jump under the cursor. */}
      <div aria-live="polite" aria-busy={loading || undefined} style={{ opacity: loading ? 0.55 : 1 }}>
        {people.items.length === 0 ? (
          <p className="dv-why">Nobody is assigned to this unit in the source system.</p>
        ) : (
          people.items.map((person) => {
            const name = person.name ?? 'Unnamed record';

            return (
              <div className="dv-person" key={person.id}>
                <div className="dv-avatar" aria-hidden="true">{initials(name)}</div>

                <div className="dv-person__n">
                  <b>{name}</b>
                  <span>{person.role ?? 'Role not recorded'}</span>
                </div>

                <div className="dv-person__c dv-person__c--hide">
                  {person.linked && person.handled !== null ? (
                    <>
                      <b>{person.handled.toLocaleString()}</b> handled
                      {people.workLabel && <> · {people.workLabel}</>}
                    </>
                  ) : (
                    person.reason ?? 'Not named by any import'
                  )}
                </div>

                <div className="dv-person__c dv-person__c--hide">
                  {person.open === null ? '' : <><b>{person.open.toLocaleString()}</b> open</>}
                </div>

                {showPresence && (
                  <div className="dv-person__load">
                    {person.presenceRate === null ? (
                      <span className="dv-person__c">Presence not recorded</span>
                    ) : (
                      <>
                        <span className="dv-person__c">
                          Presence <b>{Math.round(person.presenceRate * 100)}%</b>
                          {person.presenceDays !== null && ` of ${person.presenceDays.toLocaleString()} days`}
                        </span>
                        <Bar
                          pct={person.presenceRate * 100}
                          tone={person.presenceRate >= 0.85 ? 'good' : person.presenceRate >= 0.7 ? 'warn' : 'crit'}
                          label={`${name}: present on ${Math.round(person.presenceRate * 100)} percent of recorded days`}
                        />
                      </>
                    )}
                  </div>
                )}

                {onOpenPerson && (
                  <Button variant="ghost" size="sm" onClick={() => onOpenPerson(person.id)}>
                    Profile →
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
