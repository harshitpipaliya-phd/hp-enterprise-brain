import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar';

describe('Sidebar component', () => {
  it('renders navigation items grouped by section', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={false} onNavigate={() => {}} onLogout={() => {}} />);
    expect(screen.getByText('Organizations')).toBeTruthy();
    expect(screen.getByText('Foundation')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('disables org-scoped items when no organization is selected', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={false} onNavigate={() => {}} onLogout={() => {}} />);
    const signalsButton = screen.getByText('Signals').closest('button') as HTMLButtonElement;
    expect(signalsButton.disabled).toBe(true);
  });

  it('enables org-scoped items once an organization is selected', () => {
    render(<Sidebar currentView="list" hasSelectedOrg={true} onNavigate={() => {}} onLogout={() => {}} />);
    const signalsButton = screen.getByText('Signals').closest('button') as HTMLButtonElement;
    expect(signalsButton.disabled).toBe(false);
  });

  it('calls onNavigate with the correct view when an enabled item is clicked', () => {
    let navigatedTo: string | null = null;
    render(<Sidebar currentView="list" hasSelectedOrg={true} onNavigate={(v) => { navigatedTo = v; }} onLogout={() => {}} />);
    fireEvent.click(screen.getByText('Executive Dashboard'));
    expect(navigatedTo).toBe('executive');
  });

  it('does not navigate when a disabled (org-required) item is clicked without an org selected', () => {
    let navigatedTo: string | null = null;
    render(<Sidebar currentView="list" hasSelectedOrg={false} onNavigate={(v) => { navigatedTo = v; }} onLogout={() => {}} />);
    fireEvent.click(screen.getByText('Signals'));
    expect(navigatedTo).toBe(null);
  });

  it('calls onLogout when the logout button is clicked', () => {
    let loggedOut = false;
    render(<Sidebar currentView="list" hasSelectedOrg={false} onNavigate={() => {}} onLogout={() => { loggedOut = true; }} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(loggedOut).toBe(true);
  });
});
