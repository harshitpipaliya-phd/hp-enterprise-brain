import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../api/client';
import { getAccessToken } from '../utils/authTokens';

interface ConfigContextValue {
  terminology: Record<string, string>;
  branding: Record<string, string> | null;
  navigation: any[];
  setTerminology: (t: Record<string, string>) => void;
  setBranding: (b: Record<string, string> | null) => void;
  setNavigation: (n: any[]) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export const ConfigProvider: React.FC<{ children: ReactNode; tenantId: string; industryCode: string; roleKey: string }> = ({
  children,
  tenantId,
  industryCode,
  roleKey,
}) => {
  const [terminology, setTerminology] = useState<Record<string, string>>({});
  const [branding, setBranding] = useState<Record<string, string> | null>(null);
  const [navigation, setNavigation] = useState<any[]>([]);

  useEffect(() => {
    if (!tenantId || !industryCode || !roleKey) return;

    const headers = { Accept: 'application/json', Authorization: `Bearer ${getAccessToken()}` };

    Promise.all([
      fetch(`${API_BASE}/terminology/${tenantId}?industry_code=${encodeURIComponent(industryCode)}`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/navigation/${tenantId}?industry_code=${encodeURIComponent(industryCode)}&role_key=${encodeURIComponent(roleKey)}`, { headers }).then(r => r.json()),
    ])
      .then(([termData, navData]) => {
        const termMap: Record<string, string> = {};
        for (const t of termData as any[]) {
          termMap[t.entity_type] = t.display_name;
        }
        setTerminology(termMap);
        setNavigation(navData);
      })
      .catch(() => {});
  }, [tenantId, industryCode, roleKey]);

  return (
    <ConfigContext.Provider value={{ terminology, branding, navigation, setTerminology, setBranding, setNavigation }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextValue => {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
};
