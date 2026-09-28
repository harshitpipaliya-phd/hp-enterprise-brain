import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GlobalSearch from '../src/components/workspace/GlobalSearch';

const businessSearch = vi.fn();
const graphSearch = vi.fn();

vi.mock('../src/api/intelligence', () => ({
  api: { search: (...args: unknown[]) => businessSearch(...args) },
}));

vi.mock('../src/api/graph', () => ({
  graphApi: { search: (...args: unknown[]) => graphSearch(...args) },
}));

beforeEach(() => {
  businessSearch.mockReset();
  graphSearch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Opening a result must use the real entity type and id the endpoint
 * returned — never treat the display label as an id, and never invent a
 * destination for a type this application has none for.
 */
describe('GlobalSearch — opening a result', () => {
  it('opens a graph Department result straight into that department', async () => {
    graphSearch.mockResolvedValue({
      results: [{ labels: ['Department'], properties: { id: '2', name: 'Surgery' } }],
    });
    businessSearch.mockResolvedValue({ results: [] });

    const onOpenDepartment = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenDepartment={onOpenDepartment} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'surgery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Surgery');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenDepartment).toHaveBeenCalledWith('2');
  });

  it('opens a graph Person result straight into that person', async () => {
    graphSearch.mockResolvedValue({
      results: [{ labels: ['Person'], properties: { id: '11', name: 'Asha Rao' } }],
    });
    businessSearch.mockResolvedValue({ results: [] });

    const onOpenPerson = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenPerson={onOpenPerson} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'asha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Asha Rao');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenPerson).toHaveBeenCalledWith('11');
  });

  it('opens a graph Signal result into its full Signal Chain', async () => {
    graphSearch.mockResolvedValue({
      results: [{ labels: ['Signal'], properties: { id: 's-9', title: 'Fee collection delay' } }],
    });
    businessSearch.mockResolvedValue({ results: [] });

    const onOpenChain = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenChain={onOpenChain} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'fee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Fee collection delay');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenChain).toHaveBeenCalledWith('s-9');
  });

  it('leaves a business-search result with no destination (a learning) non-interactive, exactly as before', async () => {
    businessSearch.mockResolvedValue({
      results: [{ entityType: 'learnings', id: 'l-1', headline: 'Fee reminders sent earlier improve on-time payment' }],
    });
    graphSearch.mockResolvedValue({ results: [] });

    const onOpenDepartment = vi.fn();
    const onOpenPerson = vi.fn();
    const onOpenChain = vi.fn();
    const onOpenCase = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenDepartment={onOpenDepartment} onOpenPerson={onOpenPerson} onOpenChain={onOpenChain} onOpenCase={onOpenCase} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'fee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Fee reminders sent earlier improve on-time payment');
    expect(result.closest('[role="button"]')).toBeNull();

    fireEvent.click(result);
    expect(onOpenDepartment).not.toHaveBeenCalled();
    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(onOpenChain).not.toHaveBeenCalled();
    expect(onOpenCase).not.toHaveBeenCalled();
  });

  it('opens a business-search case result (lowercase entityType) straight into that case', async () => {
    businessSearch.mockResolvedValue({
      results: [{ entityType: 'cases', id: 'c-1', headline: 'Fee collection delays — East campus' }],
    });
    graphSearch.mockResolvedValue({ results: [] });

    const onOpenCase = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenCase={onOpenCase} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'fee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Fee collection delays — East campus');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenCase).toHaveBeenCalledWith('c-1');
  });

  it('opens a graph Case result (capitalised label) straight into that case', async () => {
    graphSearch.mockResolvedValue({
      results: [{ labels: ['Case'], properties: { id: 'c-2', title: 'Radiology backlog' } }],
    });
    businessSearch.mockResolvedValue({ results: [] });

    const onOpenCase = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenCase={onOpenCase} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'radiology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Radiology backlog');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenCase).toHaveBeenCalledWith('c-2');
  });

  it('opens an evidence result into the chain of the signal it supports, using the record the endpoint already sent', async () => {
    businessSearch.mockResolvedValue({
      results: [{
        entityType: 'evidence', id: 'ev-1', headline: 'school_fee',
        record: { id: 'ev-1', signalId: 'sig-9', source: 'school_fee' },
      }],
    });
    graphSearch.mockResolvedValue({ results: [] });

    const onOpenChain = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenChain={onOpenChain} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'school_fee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('school_fee');
    fireEvent.click(result.closest('[role="button"]')!);

    expect(onOpenChain).toHaveBeenCalledWith('sig-9');
  });

  it('leaves an evidence result with no signal to trace non-interactive rather than guessing a chain', async () => {
    businessSearch.mockResolvedValue({
      results: [{
        entityType: 'evidence', id: 'ev-2', headline: 'manual note',
        record: { id: 'ev-2', signalId: null },
      }],
    });
    graphSearch.mockResolvedValue({ results: [] });

    const onOpenChain = vi.fn();
    render(<GlobalSearch tenantId="tenant-1" onOpenChain={onOpenChain} />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'manual' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('manual note');
    expect(result.closest('[role="button"]')).toBeNull();
    expect(onOpenChain).not.toHaveBeenCalled();
  });

  it('stays non-interactive for a supported graph label with no navigator supplied', async () => {
    graphSearch.mockResolvedValue({
      results: [{ labels: ['Department'], properties: { id: '2', name: 'Surgery' } }],
    });
    businessSearch.mockResolvedValue({ results: [] });

    render(<GlobalSearch tenantId="tenant-1" />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'surgery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    const result = await screen.findByText('Surgery');
    expect(result.closest('[role="button"]')).toBeNull();
  });

  it('still shows no-results and error states as before', async () => {
    businessSearch.mockResolvedValue({ results: [] });
    graphSearch.mockResolvedValue({ results: [] });

    render(<GlobalSearch tenantId="tenant-1" />);

    fireEvent.change(screen.getByPlaceholderText('Search across everything...'), { target: { value: 'nothing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(screen.getByText('No results.')).toBeInTheDocument());
  });
});
