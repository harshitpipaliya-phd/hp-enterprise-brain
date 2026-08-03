import { renderHook, act } from '@testing-library/react';
import { FeatureFlagProvider, useFeatureFlag } from '../src/contexts/FeatureFlagContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FeatureFlagProvider tenantId="test-tenant">{children}</FeatureFlagProvider>
);

describe('FeatureFlagContext', () => {
  it('starts with empty flags', () => {
    const { result } = renderHook(() => useFeatureFlag(), { wrapper });
    expect(Object.keys(result.current.flags).length).toBe(0);
  });

  it('isEnabled returns false for unknown flag', () => {
    const { result } = renderHook(() => useFeatureFlag(), { wrapper });
    expect(result.current.isEnabled('unknown')).toBe(false);
  });

  it('setFlag updates flag state', () => {
    const { result } = renderHook(() => useFeatureFlag(), { wrapper });
    act(() => { result.current.setFlag('test_flag', true); });
    expect(result.current.isEnabled('test_flag')).toBe(true);
  });
});
