import { render, screen } from '@testing-library/react';
import { PermissionState } from '../src/components/states/PermissionState';

describe('PermissionState', () => {
  it('renders permission denied message', () => {
    render(<PermissionState />);
    expect(screen.getByText('Permission Denied')).toBeTruthy();
  });

  it('renders required permission when provided', () => {
    render(<PermissionState requiredPermission="settings.manage" />);
    expect(screen.getByText(/Required: settings.manage/)).toBeTruthy();
  });
});
