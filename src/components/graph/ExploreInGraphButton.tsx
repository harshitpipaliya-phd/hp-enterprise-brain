import { Share2 } from 'lucide-react';

/**
 * "Explore in Graph" — the cross-screen entry point.
 *
 * ONE COMPONENT, so the action reads identically wherever it appears and so the
 * contract with Graph Explorer is stated in exactly one place: a LABEL and an
 * ID, both of which the calling screen already has because they are the same
 * ids it loaded the entity with. Nothing is re-derived, no second identity
 * scheme is introduced, and no entity detail logic is duplicated — the graph
 * looks the entity up under the caller's own tenant, and an id that is not that
 * tenant's simply does not resolve.
 *
 * IT IS OPTIONAL EVERYWHERE IT IS USED. Every host screen takes the handler as
 * an optional prop and renders nothing when it is absent, so a screen mounted
 * without navigation (a test, a future embed) is unaffected.
 */
export function ExploreInGraphButton({
  label, id, entityName, onExplore, className = 'u-btn u-btn-ghost u-btn-sm',
}: {
  /** The graph node label — 'Person', 'Department', 'Student', 'Signal', … */
  label: string;
  id: string;
  /** Named in the accessible label, so the action is unambiguous in a list. */
  entityName?: string;
  onExplore?: (label: string, id: string) => void;
  className?: string;
}) {
  if (!onExplore || !id) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => onExplore(label, id)}
      title={`Open Graph Explorer centred on this ${label.toLowerCase()}`}
      aria-label={entityName ? `Explore ${entityName} in the graph` : `Explore this ${label.toLowerCase()} in the graph`}
    >
      <Share2 size={13} aria-hidden="true" />
      Explore in Graph
    </button>
  );
}
