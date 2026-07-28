import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../src/components/CommandPalette';

describe('CommandPalette', () => {
  it('is closed by default', () => {
    render(<CommandPalette onNavigate={() => {}} hasSelectedOrg={true} />);
    expect(screen.queryByLabelText('Command palette search')).toBeNull();
  });

  it('opens on Ctrl+K', () => {
    render(<CommandPalette onNavigate={() => {}} hasSelectedOrg={true} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByLabelText('Command palette search')).toBeTruthy();
  });

  it('closes on Escape', () => {
    render(<CommandPalette onNavigate={() => {}} hasSelectedOrg={true} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByLabelText('Command palette search')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByLabelText('Command palette search')).toBeNull();
  });

  it('filters results as the user types', () => {
    render(<CommandPalette onNavigate={() => {}} hasSelectedOrg={true} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByLabelText('Command palette search');
    fireEvent.change(input, { target: { value: 'executive' } });
    expect(screen.getByText('Executive Dashboard')).toBeTruthy();
    expect(screen.queryByText('Task Orchestrator')).toBeNull();
  });

  it('hides org-required items when no organization is selected', () => {
    render(<CommandPalette onNavigate={() => {}} hasSelectedOrg={false} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.queryByText('Executive Dashboard')).toBeNull();
    expect(screen.getByText('Organizations')).toBeTruthy();
  });

  it('calls onNavigate and closes when a result is clicked', () => {
    let navigatedTo: string | null = null;
    render(<CommandPalette onNavigate={(v) => { navigatedTo = v; }} hasSelectedOrg={true} />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.click(screen.getByText('Executive Dashboard'));
    expect(navigatedTo).toBe('executive');
    expect(screen.queryByLabelText('Command palette search')).toBeNull();
  });
});
