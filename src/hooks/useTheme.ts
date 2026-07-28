import { useState, useEffect } from 'react';

/**
 * Dark mode (Sprint 8 — audit finding: zero dark-mode support anywhere).
 * No Tailwind in this project (confirmed absent), and every screen uses
 * inline style objects rather than a CSS-in-JS solution — so rather than
 * introduce a new styling dependency mid-project (a real architecture change,
 * out of scope here), this follows the OS preference via matchMedia and
 * exposes a small color object each screen reads from instead of hardcoding
 * hex values. Scoped to the two actual dashboard screens named in the audit
 * (Intelligence Workspace, Decision Analytics) — not a site-wide redesign.
 */
export interface Theme {
  isDark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
}

const LIGHT: Theme = { isDark: false, bg: '#ffffff', surface: '#f9fafb', border: '#e5e7eb', text: '#111827', textMuted: '#666666' };
const DARK: Theme = { isDark: true, bg: '#111827', surface: '#1f2937', border: '#374151', text: '#f3f4f6', textMuted: '#9ca3af' };

const OVERRIDE_KEY = 'hpbrain-theme-override'; // 'light' | 'dark' | null (null = follow OS)

export function getThemeOverride(): 'light' | 'dark' | null {
  const v = localStorage.getItem(OVERRIDE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

export function setThemeOverride(value: 'light' | 'dark' | null): void {
  if (value) localStorage.setItem(OVERRIDE_KEY, value);
  else localStorage.removeItem(OVERRIDE_KEY);
  window.dispatchEvent(new Event('hpbrain-theme-changed'));
}

export function useTheme(): Theme {
  const [override, setOverride] = useState<'light' | 'dark' | null>(getThemeOverride());
  const [osIsDark, setOsIsDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mq.addEventListener('change', handler);
    const overrideHandler = () => setOverride(getThemeOverride());
    window.addEventListener('hpbrain-theme-changed', overrideHandler);
    return () => { mq.removeEventListener('change', handler); window.removeEventListener('hpbrain-theme-changed', overrideHandler); };
  }, []);

  const isDark = override ? override === 'dark' : osIsDark;
  return isDark ? DARK : LIGHT;
}
