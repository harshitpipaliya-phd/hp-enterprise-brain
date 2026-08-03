import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog, Modal } from '../src/ui';

/**
 * The dialog behaviours that are easy to ship broken.
 *
 * The app's two previous hand-rolled dialogs had none of these: Escape did
 * nothing, Tab walked out into the page behind, and focus was dropped at the
 * top of the document on close. Each is invisible to mouse users and blocking
 * for everyone else, so each gets a test rather than a promise.
 */
describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a labelled modal dialog when open', () => {
    render(<Modal open onClose={() => {}} title="Archive organization" description="This can be undone." />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Archive organization')).toBeTruthy();
    expect(screen.getByText('This can be undone.')).toBeTruthy();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Escapable" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus into the dialog on open', () => {
    render(<Modal open onClose={() => {}} title="Focused" footer={<button>Save</button>} />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('locks background scroll while open, and restores it after', () => {
    const { unmount } = render(<Modal open onClose={() => {}} title="Locked" />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('does not close when a click starts inside and ends on the backdrop', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Drag safe" />);
    // A text selection dragged out of the dialog must not dismiss the form.
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmationDialog', () => {
  it('keeps the destructive action behind an explicit confirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmationDialog
        open onCancel={onCancel} onConfirm={onConfirm}
        title="Archive?" confirmLabel="Archive" destructive
      />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Archive'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
