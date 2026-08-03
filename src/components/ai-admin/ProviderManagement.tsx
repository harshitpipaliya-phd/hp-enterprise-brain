import React, { useState, useEffect } from 'react';

interface Provider {
  id: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  priority: number;
}

export const ProviderManagement: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    fetch(`/api/v1/ai/providers`)
      .then(r => r.json())
      .then(setProviders)
      .catch(() => {});
  }, [tenantId]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">AI Providers</h2>
      <div className="space-y-4">
        {providers.map((provider) => (
          <div key={provider.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{provider.provider_name}</h3>
                <p className="text-sm text-gray-600">{provider.provider_type}</p>
              </div>
              <span className={`rounded px-2 py-1 text-sm ${provider.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {provider.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
