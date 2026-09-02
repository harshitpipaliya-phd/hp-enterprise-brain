import type { KnowledgeDetailData } from '../../api/knowledgeLibrary';
import { NotMeasurable, Panel, shortDate } from '../intelligence/parts';
import { ConfidenceBadge, FreshnessBadge, ProvenanceBadge } from './badges';

/* ==========================================================================
 *  ONE KNOWLEDGE ASSET, IN FULL
 *
 *  Everything the shelf card compressed, plus the relationships — resolved to
 *  names the reader recognises and, where the host can navigate, to controls
 *  that go there.
 * ========================================================================== */

export interface KnowledgeDetailActions {
  onDepartment?: (id: string) => void;
  onCapability?: (id: string) => void;
  onPerson?: (id: string) => void;
  onOpenKnowledge?: (id: string) => void;
  onMarkReused?: () => void;
}

/**
 * A list of things this item is connected to.
 *
 * AN EMPTY LIST IS A SENTENCE, NOT A BLANK. "No capabilities linked" and "this
 * organization does not link capabilities" are different findings; the caller
 * supplies the one that is true so the panel never leaves the reader guessing
 * which of the two they are looking at.
 */
export function RelationshipList({
  items,
  emptyReason,
  onSelect,
}: {
  items: Array<{ id: string; name: string; sub?: string }>;
  emptyReason: string;
  onSelect?: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="kb-none kb-rel__none">{emptyReason}</p>;
  }

  return (
    <ul className="kb-rel">
      {items.map((item) => (
        <li key={item.id}>
          {onSelect ? (
            <button type="button" className="kb-link" onClick={() => onSelect(item.id)}>
              {item.name}
            </button>
          ) : (
            <span>{item.name}</span>
          )}
          {item.sub && <span className="kb-rel__sub">{item.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

export function KnowledgeDetail({
  asset,
  actions = {},
}: {
  asset: KnowledgeDetailData;
  actions?: KnowledgeDetailActions;
}) {
  return (
    <div className="kb-detail">
      <div className="kb-detail__grades">
        <FreshnessBadge freshness={asset.freshness} />
        <ConfidenceBadge confidence={asset.confidence} />
        <ProvenanceBadge provenance={asset.provenance} />
        {asset.status && <span className="kb-tag">{asset.status}</span>}
      </div>

      <Panel title="Summary">
        {asset.content ? (
          <p className="kb-body">{asset.content}</p>
        ) : (
          <p className="kb-none">This item has no body text recorded.</p>
        )}
        <p className="kb-basis">{asset.confidence.basis}</p>
      </Panel>

      <div className="kb-detail__cols">
        <Panel title="Provenance">
          <dl className="kb-fields">
            <div>
              <dt>Type</dt>
              <dd>{asset.type || <span className="kb-none">untyped</span>}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{asset.owner ?? <span className="kb-none">not recorded</span>}</dd>
            </div>
            <div>
              <dt>Origin</dt>
              <dd>{asset.provenance.detail}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{shortDate(asset.createdDate) ?? <span className="kb-none">unknown</span>}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                {shortDate(asset.updatedDate) ?? <span className="kb-none">never updated since creation</span>}
                {asset.freshness.days !== null && (
                  <span className="kb-rel__sub">{asset.freshness.days} days ago</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Reuse</dt>
              <dd>
                {asset.reuseCount > 0 ? `Marked as reused ${asset.reuseCount}×` : 'Never marked as reused'}
              </dd>
            </div>
          </dl>
          {/*
            NO VERSION HISTORY EXISTS, AND THE PANEL SAYS SO.

            hpbrain_knowledge_assets carries created_date and updated_date and
            nothing between them — there are no revisions to list. An empty
            "History" section would read as "never revised", which is a claim
            this schema cannot support.
          */}
          <p className="kb-basis">
            This table records a creation and a last-updated timestamp only. Individual revisions are not
            versioned, so the changes between them cannot be listed.
          </p>
        </Panel>

        <Panel title="Connections">
          <h4 className="kb-sub">Department</h4>
          <RelationshipList
            items={asset.department ? [{ id: asset.department.id, name: asset.department.name }] : []}
            emptyReason="No department is linked to this item."
            onSelect={actions.onDepartment}
          />

          <h4 className="kb-sub">Capabilities</h4>
          <RelationshipList
            items={asset.relatedCapabilities.map((c) => ({ id: c.id, name: c.name }))}
            emptyReason="No capabilities are linked to this item."
            onSelect={actions.onCapability}
          />

          <h4 className="kb-sub">People</h4>
          <RelationshipList
            items={asset.relatedPeople.map((p) => ({ id: p.id, name: p.name }))}
            emptyReason="No people are named on this item."
            onSelect={actions.onPerson}
          />
        </Panel>
      </div>

      <Panel title="Used in" sub="which work consulted this item">
        {/*
          The server reports this relation as unsupported rather than empty,
          and the difference is the whole point: nothing records which decision
          opened which document, so an empty list here would be read as "this
          knowledge is never used" when the truth is "usage is not tracked".
        */}
        <NotMeasurable what="Usage attribution" reason={asset.usedIn.reason} />
        <p className="kb-basis">{asset.usedIn.unlock}</p>
        {asset.reuseCount > 0 && (
          <p className="kb-basis">
            What is recorded: this item has been marked as reused {asset.reuseCount} time
            {asset.reuseCount === 1 ? '' : 's'} in total, without attribution to the work that used it.
          </p>
        )}
      </Panel>

      <Panel title="Related knowledge">
        <RelationshipList
          items={asset.relatedKnowledge.map((k) => ({
            id: k.id,
            name: k.title,
            sub: `${k.relation} · reused ${k.reuseCount}×`,
          }))}
          emptyReason="Nothing else of this type is on the shelf yet."
          onSelect={actions.onOpenKnowledge}
        />
      </Panel>
    </div>
  );
}
