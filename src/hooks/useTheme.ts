import { useState, useEffect } from 'react';

/**
 * The active theme, for the screens that still style with inline objects.
 *
 * TWO DEFECTS THIS NOW FIXES.
 *
 * 1. THE DOCUMENT WAS NEVER TOLD WHICH THEME WAS ACTIVE. `data-theme` was not
 *    set on <html> anywhere in the app, so every CSS rule fell through to the
 *    :root defaults — the light Golden Instrument — while this hook
 *    independently flipped ~21 screens to a dark palette off the OS preference.
 *    On any machine set to dark mode the shell rendered light and the screens
 *    inside it rendered dark. Applying the attribute here makes the stylesheet
 *    and the inline styles read the same answer, because there is now only one.
 *
 * 2. THE PALETTE WAS NOT THE PRODUCT'S. It returned #f9fafb / #e5e7eb /
 *    #111827 — a generic grey ramp with no relation to HP Brain's ink, gold and
 *    teal identity. That is the whole reason those screens looked like a
 *    different application from the dashboard. The values now come from the
 *    design tokens themselves, read off the document, so this hook cannot drift
 *    from the stylesheet again.
 *
 * @deprecated Still deprecated as an API — inline style objects cannot express
 * hover, focus or media queries, so a screen styled this way is permanently
 * missing states the .eb-* classes get for free. Migrate screens to those
 * classes; this now keeps the remaining ones honest in the meantime rather than
 * actively fighting the design system.
 */
export interface Theme {
  isDark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
}

/**
 * Fallbacks, used when a computed value is unavailable.
 *
 * That happens in jsdom, which does not resolve custom properties — without
 * these, every test rendering one of these screens would style it with empty
 * strings. The values mirror the tokens they stand in for.
 */
const FALLBACK_LIGHT: Theme = {
  isDark: false,
  bg: '#FAF7F0',
  surface: '#FFFFFF',
  border: 'rgba(34, 51, 79, 0.12)',
  text: '#0B1220',
  textMuted: '#5A6882',
};

const FALLBACK_DARK: Theme = {
  isDark: true,
  bg: '#0B1220',
  surface: '#101A2B',
  border: 'rgba(148, 170, 214, 0.12)',
  text: '#EDF2FB',
  textMuted: '#7D8CA8',
};

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

/** One design token, resolved against the document. */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !document.documentElement) return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readTheme(isDark: boolean): Theme {
  const fb = isDark ? FALLBACK_DARK : FALLBACK_LIGHT;

  return {
    isDark,
    bg: token('--surface-ground', fb.bg),
    surface: token('--surface-card', fb.surface),
    border: token('--border-subtle', fb.border),
    text: token('--content-primary', fb.text),
    textMuted: token('--content-tertiary', fb.textMuted),
  };
}

/**
 * Publishes the active theme to the document.
 *
 * This attribute is what selects which block of custom properties applies, so
 * it has to be set before the tokens are read — otherwise the inline styles
 * stay one flip behind the CSS.
 */
function applyThemeAttribute(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

export function useTheme(): Theme {
  const [override, setOverride] = useState<'light' | 'dark' | null>(getThemeOverride());
  const [osIsDark, setOsIsDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const isDark = override ? override === 'dark' : osIsDark;

  // Applied from an effect rather than the render body: setting an attribute on
  // <html> is a DOM mutation, and React is free to run a render body twice or
  // throw its result away.
  useEffect(() => {
    applyThemeAttribute(isDark);
  }, [isDark]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mq.addEventListener('change', handler);

    const overrideHandler = () => setOverride(getThemeOverride());
    window.addEventListener('hpbrain-theme-changed', overrideHandler);

    return () => {
      mq.removeEventListener('change', handler);
      window.removeEventListener('hpbrain-theme-changed', overrideHandler);
    };
  }, []);

  return readTheme(isDark);
}
