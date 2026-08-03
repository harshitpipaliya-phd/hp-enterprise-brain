import React, { useState, useEffect } from 'react';

interface Quota {
  id: string;
  quota_type: string;
  quota_key: string;
  limit_value: number;
  current_usage: number;
}

export const QuotaManagement: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [quotas, setQuotas] = useState<Quota[]>([]);

  useEffect(() => {
    fetch(`/api/v1/ai/quotas/${tenantId}`)
      .then(r => r.json())
      .then(setQuotas)
      .catch(() => {});
  }, [tenantId]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">AI Quotas</h2>
      <div className="space-y-4">
        {quotas.map((quota) => {
          const percentage = quota.limit_value > 0 ? (quota.current_usage / quota.limit_value) * 100 : 0;
          return (
            <div key={quota.id} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{quota.quota_key}</h3>
                  <p className="text-sm text-gray-600">{quota.quota_type}</p>
                </div>
                <span className="text-sm">{quota.current_usage} / {quota.limit_value}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, percentage)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
