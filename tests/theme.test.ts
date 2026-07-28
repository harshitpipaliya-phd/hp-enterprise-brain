import { describe, it, expect, beforeEach } from 'vitest';
import { getThemeOverride, setThemeOverride } from '../src/hooks/useTheme';

describe('theme override', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no override has been set (follows OS preference)', () => {
    expect(getThemeOverride()).toBe(null);
  });

  it('persists an explicit dark override to localStorage', () => {
    setThemeOverride('dark');
    expect(getThemeOverride()).toBe('dark');
    expect(localStorage.getItem('hpbrain-theme-override')).toBe('dark');
  });

  it('persists an explicit light override', () => {
    setThemeOverride('light');
    expect(getThemeOverride()).toBe('light');
  });

  it('clears the override (returns to following OS) when set to null', () => {
    setThemeOverride('dark');
    setThemeOverride(null);
    expect(getThemeOverride()).toBe(null);
    expect(localStorage.getItem('hpbrain-theme-override')).toBe(null);
  });

  it('dispatches a change event so other mounted components stay in sync', () => {
    let fired = false;
    window.addEventListener('hpbrain-theme-changed', () => { fired = true; }, { once: true });
    setThemeOverride('dark');
    expect(fired).toBe(true);
  });

  it('ignores garbage values stored directly in localStorage (defensive read)', () => {
    localStorage.setItem('hpbrain-theme-override', 'not-a-real-theme');
    expect(getThemeOverride()).toBe(null);
  });
});
