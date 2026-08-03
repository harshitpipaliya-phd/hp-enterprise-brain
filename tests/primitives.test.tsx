import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Button, DataTable, Field, IconButton, MetricCard, StatusBadge, TextInput,
} from '../src/ui';

/** Phase 1 primitive contract — the parts that are easy to ship subtly broken. */

describe('Field wiring', () => {
  it('associates the label with the control', () => {
    render(<Field label="Organization name"><TextInput /></Field>);
    // getByLabelText only resolves if label/for/id are genuinely connected.
    expect(screen.getByLabelText('Organization name')).toBeTruthy();
  });

  it('exposes the error to assistive tech via aria-describedby', () => {
    render(<Field label="Code" error="This code is already in use."><TextInput /></Field>);

    const input = screen.getByLabelText('Code');
    const describedBy = input.getAttribute('aria-describedby');

    expect(describedBy).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    // The message must be the element the input actually points at — a visible
    // error that is not referenced is invisible to a screen reader.
    expect(document.getElementById(describedBy!)?.textContent).toContain('already in use');
  });

  it('describes the control with help text when there is no error', () => {
    render(<Field label="Code" help="Up to 8 characters."><TextInput /></Field>);
    const input = screen.getByLabelText('Code');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent)
      .toContain('Up to 8 characters');
  });

  it('marks required fields for assistive tech, not just with an asterisk', () => {
    render(<Field label="Name" required><TextInput /></Field>);
    expect(screen.getByLabelText('Name').getAttribute('aria-required')).toBe('true');
  });

  it('does not override an id the caller set', () => {
    render(<Field label="Name"><TextInput id="custom-id" /></Field>);
    expect(screen.getByLabelText('Name').id).toBe('custom-id');
  });
});

describe('Button states', () => {
  it('is disabled and announced busy while loading', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    screen.getByRole('button').click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type=button so it cannot submit a form by accident', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('IconButton', () => {
  it('always carries an accessible name', () => {
    render(<IconButton label="Close dialog">×</IconButton>);
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy();
  });
});

describe('StatusBadge', () => {
  it('carries a glyph as well as a hue, so status is never colour-alone', () => {
    const { container } = render(<StatusBadge tone="success">Active</StatusBadge>);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('omits the glyph only when explicitly asked', () => {
    const { container } = render(<StatusBadge tone="success" icon={false}>Active</StatusBadge>);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('MetricCard', () => {
  it('is a button only when it navigates somewhere', () => {
    const { rerender, container } = render(<MetricCard label="Risks" value={3} />);
    expect(container.querySelector('button')).toBeNull();

    rerender(<MetricCard label="Risks" value={3} onClick={() => {}} />);
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('keeps the value in text colour, carrying status on the rail instead', () => {
    const { container } = render(<MetricCard label="Risks" value={3} status="crit" />);
    expect(container.querySelector('.u-metric')?.getAttribute('data-status')).toBe('crit');
    // No inline colour on the number — it must inherit the text token.
    expect(container.querySelector('.u-metric-value')?.getAttribute('style')).toBeNull();
  });
});

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Organization', render: (r: any) => r.name },
    { key: 'code', header: 'Code', render: (r: any) => r.code },
  ];
  const rows = [{ id: '1', name: 'Scholar Clone', code: 'SCL' }];

  it('labels every cell for the mobile card layout', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(r: any) => r.id} />,
    );
    // Below 720px the header row is hidden and these supply the field names.
    const labels = Array.from(container.querySelectorAll('td')).map((td) => td.getAttribute('data-label'));
    expect(labels).toEqual(['Organization', 'Code']);
  });

  it('gives truncated string cells a title so the full value stays reachable', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} rowKey={(r: any) => r.id} />,
    );
    const td = container.querySelector('td');
    expect(td?.getAttribute('title')).toBe('Scholar Clone');
    expect(td?.className).toContain('u-cell-truncate');
  });

  it('shows an empty state rather than a bare table', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r: any) => r.id} />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });

  it('shows an error state with a retry when the load failed', () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} rows={[]} rowKey={(r: any) => r.id} error="Network down" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    screen.getByText('Try again').click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('announces loading to assistive tech', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r: any) => r.id} loading />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
  });

  it('reports sort direction on the header', () => {
    render(
      <DataTable
        columns={[{ ...columns[0], sortable: true }, columns[1]]}
        rows={rows} rowKey={(r: any) => r.id}
        sortKey="name" sortDirection="asc" onSort={() => {}}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Organization/ }).getAttribute('aria-sort')).toBe('ascending');
  });
});
