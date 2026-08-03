import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FeatureFlagContextValue {
  flags: Record<string, boolean>;
  isEnabled: (key: string) => boolean;
  setFlag: (key: string, value: boolean) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export const FeatureFlagProvider: React.FC<{ children: ReactNode; tenantId: string }> = ({ children, tenantId }) => {
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!tenantId) return;

    fetch(`/api/v1/feature-flags/${tenantId}`)
      .then(r => r.json())
      .then((data: any[]) => {
        const map: Record<string, boolean> = {};
        for (const flag of data) {
          map[flag.flag_key] = flag.enabled;
        }
        setFlags(map);
      })
      .catch(() => {});
  }, [tenantId]);

  const isEnabled = (key: string): boolean => flags[key] ?? false;

  const setFlag = (key: string, value: boolean) => {
    setFlags(prev => ({ ...prev, [key]: value }));
  };

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled, setFlag }}>
      {children}
    </FeatureFlagContext.Provider>
  );
};

export const useFeatureFlag = (): FeatureFlagContextValue => {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error('useFeatureFlag must be used within FeatureFlagProvider');
  return ctx;
};
