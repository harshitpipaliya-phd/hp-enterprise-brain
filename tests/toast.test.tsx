import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../src/components/Toast';

function TriggerButton({ type = 'success' as const }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(type, 'Test message')}>Trigger</button>;
}

describe('Toast system', () => {
  it('renders nothing when no toast has been triggered', () => {
    render(<ToastProvider><div>content</div></ToastProvider>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a toast with the given message when triggered', () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => { screen.getByText('Trigger').click(); });
    expect(screen.getByText('Test message')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('auto-dismisses a toast after 4 seconds', () => {
    vi.useFakeTimers();
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => { screen.getByText('Trigger').click(); });
    expect(screen.queryByText('Test message')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4001); });
    expect(screen.queryByText('Test message')).toBeNull();
    vi.useRealTimers();
  });

  it('throws a clear error if useToast is used outside a ToastProvider', () => {
    const BadComponent = () => { useToast(); return null; };
    expect(() => render(<BadComponent />)).toThrow(/useToast must be used within a ToastProvider/);
  });
});
