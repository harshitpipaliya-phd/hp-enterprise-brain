import React from 'react';
import { CornerDownLeft, Search } from 'lucide-react';
import type { View } from '../App';
import { VIEW_META } from './viewMeta';
import { navViewsForRole } from './roleAccess';

/**
 * Keyboard jump-to-screen.
 *
 * SCOPE IS DELIBERATELY NARROW: it lists the views this role may already reach
 * and filters them by label. It does not query the backend, does not surface
 * records, and offers no "actions" — that is Global Search's job, and a palette
 * that half-does it would return a thin, misleading subset of what the search
 * screen finds.
 *
 * The list is built from the SAME role filter as the sidebar, so a screen the
 * menu hides can never be reached by typing its name here.
 */
export function CommandPalette({
  open, onClose, userRole, hasSelectedOrg, onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  userRole: string | null;
  hasSelectedOrg: boolean;
  onNavigate: (view: View) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);
  const listId = React.useId();

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    return navViewsForRole(userRole)
      .filter((v) => !(VIEW_META[v].requiresOrg && !hasSelectedOrg))
      .filter((v) => {
        if (!q) return true;
        const m = VIEW_META[v];
        return m.label.toLowerCase().includes(q) || m.section.toLowerCase().includes(q);
      });
  }, [query, userRole, hasSelectedOrg]);

  React.useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setIndex(0);
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  // Clamped whenever the filter shrinks the list, so the highlight can never
  // point past the end and Enter can never select nothing.
  React.useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const choose = (view: View) => { onClose(); onNavigate(view); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % Math.max(1, results.length)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + results.length) % Math.max(1, results.length)); return; }
    if (e.key === 'Enter' && results[index]) { e.preventDefault(); choose(results[index]); }
  };

  return (
    <div className="s-palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="s-palette" role="dialog" aria-modal="true" aria-label="Jump to a screen">
        <div className="s-palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Jump to a screen…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-controls={listId}
            aria-activedescendant={results[index] ? `${listId}-${results[index]}` : undefined}
            aria-autocomplete="list"
            role="combobox"
            aria-expanded="true"
          />
          <kbd className="s-kbd">Esc</kbd>
        </div>

        {/* Announced, so a screen-reader user learns the list changed as they
            type rather than having to arrow through it to find out. */}
        <p className="u-sr-only" role="status">
          {results.length === 0 ? 'No screens match' : `${results.length} screen${results.length === 1 ? '' : 's'} available`}
        </p>

        <ul className="s-palette-list" id={listId} role="listbox">
          {results.length === 0 && <li className="s-palette-empty">No screens match “{query}”.</li>}

          {results.map((view, i) => {
            const meta = VIEW_META[view];
            const Icon = meta.icon;
            return (
              <li
                key={view}
                id={`${listId}-${view}`}
                role="option"
                aria-selected={i === index}
                className={`s-palette-item${i === index ? ' s-palette-item-active' : ''}`}
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(view); }}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="s-palette-label">{meta.label}</span>
                <span className="s-palette-section">{meta.section}</span>
                {i === index && <CornerDownLeft size={14} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Ctrl+K / Cmd+K. */
export function useCommandPaletteHotkey(onOpen: () => void) {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onOpen]);
}
