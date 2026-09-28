import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OverviewListCard } from '../src/components/workspace/CommandCenter';

/**
 * The Organization overview's department/data-source list rows.
 *
 * WHAT THIS PINS. The department ids reaching this card were always real —
 * see CommandCenter's `summaryDepartments` — but every row rendered as inert
 * text with nowhere to send a click. `onSelectRow` is what turns a row into
 * a jump into that entity's own intelligence screen; omitting it (as the
 * "Data sources" card does, since a data source has no intelligence screen
 * of its own) must keep the row as plain text, not a dead button.
 */
describe('OverviewListCard', () => {
  const rows = [
    { id: 'dept-1', title: 'Surgery', meta: '12 people' },
    { id: 'dept-2', title: 'Radiology', meta: '4 people' },
  ];

  it('renders each row as a clickable jump when onSelectRow is given', () => {
    const onSelectRow = vi.fn();
    render(
      <OverviewListCard
        title="Departments"
        actionLabel="View all"
        onAction={() => {}}
        empty="No departments."
        rows={rows}
        onSelectRow={onSelectRow}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Surgery/ }));
    expect(onSelectRow).toHaveBeenCalledWith('dept-1');

    fireEvent.click(screen.getByRole('button', { name: /Radiology/ }));
    expect(onSelectRow).toHaveBeenCalledWith('dept-2');
  });

  it('renders rows as plain text, not a button, when onSelectRow is omitted', () => {
    render(
      <OverviewListCard
        title="Data sources"
        actionLabel="Import data"
        onAction={() => {}}
        empty="No sources."
        rows={rows}
      />,
    );

    expect(screen.getByText('Surgery')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Surgery/ })).not.toBeInTheDocument();
  });

  it('still exposes the header action regardless of row click-through', () => {
    const onAction = vi.fn();
    render(
      <OverviewListCard title="Departments" actionLabel="View all" onAction={onAction} empty="None." rows={rows} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
