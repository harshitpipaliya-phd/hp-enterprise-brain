import { useState, useEffect } from 'react';

interface UseNavigationOptions {
  tenantId: string;
  industryCode: string;
  roleKey: string;
  enabledModules: string[];
}

export function useNavigation({ tenantId, industryCode, roleKey, enabledModules }: UseNavigationOptions) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !industryCode || !roleKey) return;

    setLoading(true);
    setError(null);

    fetch(`/api/v1/navigation/${tenantId}?industry_code=${encodeURIComponent(industryCode)}&role_key=${encodeURIComponent(roleKey)}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch navigation');
        return r.json();
      })
      .then(data => {
        const filtered = data.filter((item: any) => {
          if (item.required_module && !enabledModules.includes(item.required_module)) return false;
          return true;
        });
        setItems(filtered);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [tenantId, industryCode, roleKey, enabledModules]);

  return { items, loading, error };
}
