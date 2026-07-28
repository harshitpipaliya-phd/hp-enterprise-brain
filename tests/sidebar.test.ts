import { describe, it, expect } from 'vitest';
import { breadcrumbFor } from '../src/components/Sidebar';

describe('breadcrumbFor', () => {
  it('returns Home for a view with no org context required', () => {
    const trail = breadcrumbFor('list');
    expect(trail[0]).toBe('Home');
    expect(trail).toContain('Foundation');
    expect(trail).toContain('Organizations');
  });

  it('includes the org name when the view requires an org and one is selected', () => {
    const trail = breadcrumbFor('signals', 'Acme School District');
    expect(trail).toContain('Acme School District');
    expect(trail).toContain('Signals');
  });

  it('omits the org name when the view does not require one, even if provided', () => {
    const trail = breadcrumbFor('list', 'Acme School District');
    expect(trail).not.toContain('Acme School District');
  });

  it('falls back to the raw view name for an unrecognized view', () => {
    const trail = breadcrumbFor('nonexistent-view' as any);
    expect(trail).toContain('nonexistent-view');
  });
});
