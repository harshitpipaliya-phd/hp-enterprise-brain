import { render, screen } from '@testing-library/react';
import { PermissionState } from '../src/components/states/PermissionState';

/**
 * Copy comes from ui/primitives' PermissionDeniedState. It is deliberately
 * written as a sentence to the reader rather than as the status name
 * "Permission Denied", which is what this file used to assert.
 */
describe('PermissionState', () => {
  it('renders permission denied message', () => {
    render(<PermissionState />);
    expect(screen.getByRole('heading', { name: /don.t have access/i })).toBeTruthy();
  });

  it('renders required permission when provided', () => {
    render(<PermissionState requiredPermission="settings.manage" />);
    expect(screen.getByText(/settings\.manage/)).toBeTruthy();
  });
});
