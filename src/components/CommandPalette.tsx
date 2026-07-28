import { useState, useEffect, useRef } from 'react';
import type { View } from '../App';
import { useTheme } from '../hooks/useTheme';
import { NAV_ITEMS_FOR_PALETTE } from './Sidebar';

interface CommandPaletteProps {
  onNavigate: (view: View) => void;
  hasSelectedOrg: boolean;
}

/**
 * Command Palette (Ctrl+K / Cmd+K). Real: searches the same navigation
 * registry the Sidebar uses (single source of truth), keyboard-navigable,
 * respects the same org-required gating as the sidebar.
 */
export function CommandPalette({ onNavigate, hasSelectedOrg }: CommandPaletteProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = NAV_ITEMS_FOR_PALETTE.filter((item) =>
    !query || item.label.toLowerCase().includes(query.toLowerCase()) || item.section.toLowerCase().includes(query.toLowerCase())
  ).filter((item) => !item.requiresOrg || hasSelectedOrg);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIndex]) {
      onNavigate(results[selectedIndex].view);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: 480, backgroundColor: theme.surface, borderRadius: 10, border: `1px solid ${theme.border}`, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a screen..."
          aria-label="Command palette search"
          style={{ width: '100%', padding: 16, border: 'none', outline: 'none', backgroundColor: 'transparent', color: theme.text, fontSize: 15, boxSizing: 'border-box' }}
        />
        <div style={{ borderTop: `1px solid ${theme.border}`, maxHeight: 320, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 16, color: theme.textMuted, fontSize: 13 }}>No matching screens.</div>
          ) : results.map((item, i) => (
            <div
              key={item.view}
              onClick={() => { onNavigate(item.view); setOpen(false); }}
              onMouseEnter={() => setSelectedIndex(i)}
              style={{ padding: '10px 16px', cursor: 'pointer', backgroundColor: i === selectedIndex ? '#3b82f620' : 'transparent', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{item.label}</span>
              <span style={{ color: theme.textMuted, fontSize: 11 }}>{item.section}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 16px', borderTop: `1px solid ${theme.border}`, fontSize: 11, color: theme.textMuted }}>
          ↑↓ navigate · ↵ select · esc close
        </div>
      </div>
    </div>
  );
}
