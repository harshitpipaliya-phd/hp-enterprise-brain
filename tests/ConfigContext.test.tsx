import { renderHook, act } from '@testing-library/react';
import { ConfigProvider, useConfig } from '../src/contexts/ConfigContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ConfigProvider tenantId="test-tenant" industryCode="healthcare" roleKey="admin">
    {children}
  </ConfigProvider>
);

describe('ConfigContext', () => {
  it('starts with empty terminology', () => {
    const { result } = renderHook(() => useConfig(), { wrapper });
    expect(Object.keys(result.current.terminology).length).toBe(0);
  });

  it('starts with null branding', () => {
    const { result } = renderHook(() => useConfig(), { wrapper });
    expect(result.current.branding).toBeNull();
  });

  it('setTerminology updates terminology', () => {
    const { result } = renderHook(() => useConfig(), { wrapper });
    act(() => { result.current.setTerminology({ Person: 'Patient' }); });
    expect(result.current.terminology['Person']).toBe('Patient');
  });

  it('setBranding updates branding', () => {
    const { result } = renderHook(() => useConfig(), { wrapper });
    act(() => { result.current.setBranding({ primary_color: '#ff0000' }); });
    expect(result.current.branding).toEqual({ primary_color: '#ff0000' });
  });
});
