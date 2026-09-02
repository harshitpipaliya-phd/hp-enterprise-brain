import type { KnowledgeCardData } from '../../api/knowledgeLibrary';
import { ConfidenceBadge, FreshnessBadge, ProvenanceBadge } from './badges';

/* ==========================================================================
 *  ONE ITEM ON THE SHELF
 *
 *  A knowledge card has to answer four questions before the reader clicks:
 *  what is it, why would I use it, can I trust it, and is it still current.
 *  A filename and a date answer none of them — which is what separates this
 *  from a document table.
 * ========================================================================== */

function typeLabel(type: string): string {
  return type ? type.replace(/[_-]+/g, ' ') : 'Untyped';
}

export function KnowledgeCard({
  asset,
  onOpen,
  onDepartment,
}: {
  asset: KnowledgeCardData;
  onOpen: () => void;
  onDepartment?: (id: string) => void;
}) {
  return (
    <article className="kb-card">
      <header className="kb-card__head">
        <span className="kb-type">{typeLabel(asset.type)}</span>
        <FreshnessBadge freshness={asset.freshness} />
      </header>

      {/*
        THE WHOLE CARD IS NOT ONE BUTTON.

        The title is the control that opens the item, so the department chip
        and the actions below can be their own controls without nesting
        interactive elements inside each other — which is invalid, and which
        breaks keyboard navigation in exactly the way that makes a screen
        unusable without a mouse.
      */}
      <h3 className="kb-card__t">
        <button type="button" onClick={onOpen}>
          {asset.title || 'Untitled'}
        </button>
      </h3>

      {asset.purpose ? (
        <p className="kb-card__p">{asset.purpose}</p>
      ) : (
        <p className="kb-card__p kb-card__p--none">
          This item has no body text, so what it is for cannot be summarised from it.
        </p>
      )}

      <dl className="kb-meta">
        <div>
          <dt>Owner</dt>
          <dd>{asset.owner ?? <span className="kb-none">not recorded</span>}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>
            {asset.department ? (
              onDepartment ? (
                <button type="button" className="kb-link" onClick={() => onDepartment(asset.department!.id)}>
                  {asset.department.name}
                </button>
              ) : (
                asset.department.name
              )
            ) : (
              <span className="kb-none">not linked</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Reuse</dt>
          <dd>
            {asset.reuseCount > 0 ? (
              <>
                {asset.reuseCount}× <span className="kb-none">reused</span>
              </>
            ) : (
              <span className="kb-none">never reused</span>
            )}
          </dd>
        </div>
      </dl>

      {asset.tags.length > 0 && (
        <div className="kb-tags">
          {asset.tags.slice(0, 4).map((t) => (
            <span className="kb-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}

      <footer className="kb-card__foot">
        <div className="kb-card__grades">
          <ConfidenceBadge confidence={asset.confidence} />
          <ProvenanceBadge provenance={asset.provenance} />
        </div>
        <div className="kb-card__acts">
          {(asset.capabilityCount > 0 || asset.personCount > 0) && (
            <span className="kb-conn">
              {asset.capabilityCount > 0 && `${asset.capabilityCount} capabilit${asset.capabilityCount === 1 ? 'y' : 'ies'}`}
              {asset.capabilityCount > 0 && asset.personCount > 0 && ' · '}
              {asset.personCount > 0 && `${asset.personCount} people`}
            </span>
          )}
          <button type="button" className="kb-open" onClick={onOpen}>
            Open →
          </button>
        </div>
      </footer>
    </article>
  );
}
