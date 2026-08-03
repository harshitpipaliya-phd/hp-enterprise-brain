import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LazyView } from '../src/ui';

/**
 * Code-split screens.
 *
 * The retry case is the one worth the most here. React.lazy memoises its
 * promise INCLUDING a rejection, so a boundary whose Retry only clears its own
 * state re-renders the same lazy object, gets the same rejected promise back,
 * and fails instantly and forever — a button that looks like a way out and is
 * not one. LazyView builds a fresh lazy component per attempt so the retry
 * genuinely re-requests.
 */
describe('LazyView', () => {
  const Loaded = () => <p>Loaded screen</p>;

  it('shows a skeleton while the import is unresolved, then the screen', async () => {
    let resolve!: (m: { default: React.ComponentType }) => void;
    const loader = () => new Promise<{ default: React.ComponentType }>((r) => { resolve = r; });

    const { container } = render(<LazyView label="Test" loader={loader} props={{}} />);

    // Fallback is present and the real screen is not.
    expect(container.querySelector('.u-skeleton')).toBeTruthy();
    expect(screen.queryByText('Loaded screen')).toBeNull();

    resolve({ default: Loaded });

    await waitFor(() => expect(screen.getByText('Loaded screen')).toBeTruthy());
    expect(container.querySelector('.u-skeleton')).toBeNull();
  });

  it('passes props straight through to the loaded screen', async () => {
    const Greet = ({ name }: { name: string }) => <p>Hello {name}</p>;
    const loader = () => Promise.resolve({ default: Greet });

    render(<LazyView label="Greet" loader={loader} props={{ name: 'Scholar Clone' }} />);

    await waitFor(() => expect(screen.getByText('Hello Scholar Clone')).toBeTruthy());
  });

  it('shows a recoverable error state when the chunk fails, not a blank screen', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const loader = () => Promise.reject(new Error('network'));

    render(<LazyView label="Decision Intelligence" loader={loader} props={{}} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(/Couldn’t load Decision Intelligence/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();

    vi.restoreAllMocks();
  });

  it('RE-IMPORTS on retry rather than replaying the cached rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    let calls = 0;
    const loader = () => {
      calls += 1;
      // Fail once, succeed on the retry — exactly the deploy-mid-session case.
      return calls === 1
        ? Promise.reject(new Error('network'))
        : Promise.resolve({ default: Loaded });
    };

    render(<LazyView label="Test" loader={loader} props={{}} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
    expect(calls).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Loaded screen')).toBeTruthy());
    // The second call is the proof: a state-only reset would leave this at 1.
    expect(calls).toBe(2);

    vi.restoreAllMocks();
  });

  it('does not call the loader until it is rendered', () => {
    const loader = vi.fn(() => Promise.resolve({ default: Loaded }));

    // Mounting nothing must not fetch the chunk — this is what keeps
    // DecisionIntelligence (and recharts) out of the initial load.
    render(<div>{false && <LazyView label="Test" loader={loader} props={{}} />}</div>);

    expect(loader).not.toHaveBeenCalled();
  });
});

/**
 * App-level wiring: the eager render path must not reach DecisionIntelligence.
 *
 * A static import anywhere in the module graph would silently pull recharts
 * back into the initial bundle and undo the split without failing anything.
 */
describe('DecisionIntelligence is not eagerly imported', () => {
  it('App.tsx references it only through a dynamic import', async () => {
    const fs = await import('node:fs');
    // process.cwd() is the web/ package root under vitest; file: URLs do not
    // survive Windows drive letters cleanly.
    const src = fs.readFileSync('src/App.tsx', 'utf8');

    expect(src).not.toMatch(/^import\s+DecisionIntelligence\s+from/m);
    expect(src).toMatch(/import\('\.\/components\/workspace\/DecisionIntelligence'\)/);
  });

  it('no other module imports it statically either', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const root = 'src';

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (full.endsWith('DecisionIntelligence.tsx')) continue;

        const text = fs.readFileSync(full, 'utf8');
        if (/^import[^\n]*from\s+['"][^'"]*DecisionIntelligence['"]/m.test(text)) {
          offenders.push(full);
        }
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});
