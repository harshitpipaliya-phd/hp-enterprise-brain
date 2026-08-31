import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { PageHeader, HeaderActions, HeaderOverflowMenu, HeaderStamp } from '../src/ui/pageHeader';

/**
 * The page header is the one component every screen in the product opens with,
 * so the things asserted here are the things that would otherwise break on
 * thirty screens at once: the document outline, the accessible structure of the
 * navigation it carries, and the promise that it renders from props alone.
 */
afterEach(cleanup);

describe('PageHeader', () => {
  it('is a banner with exactly one level-1 heading', () => {
    render(<PageHeader title="Departments" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Departments');
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('renders only the parts it was given', () => {
    const { container } = render(<PageHeader title="Departments" />);

    // No empty eyebrow, no empty description, no orphan action bar, and no
    // stray landmark — a header that renders hollow boxes for absent props is
    // what makes a bare screen look broken rather than simply quiet.
    expect(container.querySelector('.u-ph__eyebrow')).toBeNull();
    expect(container.querySelector('.u-ph__desc')).toBeNull();
    expect(container.querySelector('.u-ph__meta')).toBeNull();
    expect(container.querySelector('.u-ph__side')).toBeNull();
    expect(container.querySelector('.u-ph__top')).toBeNull();
    expect(container.querySelector('.u-ph__below')).toBeNull();
  });

  it('drops falsy metadata entries so callers can inline their conditions', () => {
    const { container } = render(
      <PageHeader
        title="Fiber Valley"
        meta={[{ label: 'telecom' }, null, false, undefined, { label: 'FV' }]}
      />,
    );

    const items = container.querySelectorAll('.u-ph__meta li');
    expect(Array.from(items).map((li) => li.textContent)).toEqual(['telecom', 'FV']);
  });

  it('carries a long metadata value in the title attribute, since it is truncated', () => {
    const address = 'a-very-long-contact-address@sunrise-international-school.example.org';
    const { container } = render(<PageHeader title="Sunrise" meta={[{ label: address }]} />);

    expect(container.querySelector('.u-ph__meta li')?.getAttribute('title')).toBe(address);
  });

  it('marks the final breadcrumb as the current page and does not make it a link', () => {
    const toOrg = vi.fn();
    render(
      <PageHeader
        title="Departments"
        breadcrumbs={[{ label: 'Fiber Valley', onClick: toOrg }, { label: 'Departments' }]}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Departments').getAttribute('aria-current')).toBe('page');
    expect(within(nav).queryByRole('button', { name: 'Departments' })).toBeNull();

    fireEvent.click(within(nav).getByRole('button', { name: 'Fiber Valley' }));
    expect(toOrg).toHaveBeenCalledTimes(1);
  });

  it('labels the back control with its destination alone', () => {
    const onBack = vi.fn();
    render(<PageHeader title="Aanya Sharma" back={{ label: 'Back to People', onClick: onBack }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to People' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the status beside the title without relying on colour alone', () => {
    render(<PageHeader title="Fiber Valley" status={{ label: 'active', tone: 'success' }} />);
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('puts actions, an aside and a below slot where the screen asked for them', () => {
    const { container } = render(
      <PageHeader
        title="Graph Explorer"
        actions={<HeaderActions><button type="button">Reset</button></HeaderActions>}
        aside={<HeaderStamp>data version 4f2a91</HeaderStamp>}
      >
        <div data-testid="modes">modes</div>
      </PageHeader>,
    );

    expect(container.querySelector('.u-ph__actions')?.textContent).toBe('Reset');
    expect(container.querySelector('.u-ph__stamp')?.textContent).toBe('data version 4f2a91');
    expect(container.querySelector('.u-ph__below')?.textContent).toBe('modes');
  });
});

describe('HeaderOverflowMenu', () => {
  it('renders nothing at all when it has no items', () => {
    const { container } = render(<HeaderOverflowMenu items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('opens, runs the item it was given, and closes again', () => {
    const onSelect = vi.fn();
    render(<HeaderOverflowMenu items={[{ label: 'Archive person', onSelect, danger: true }]} />);

    const trigger = screen.getByRole('button', { name: 'More actions' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menuitem')).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive person' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('closes on Escape and gives focus back to the trigger', () => {
    render(<HeaderOverflowMenu items={[{ label: 'Source record', onSelect: vi.fn() }]} />);

    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
