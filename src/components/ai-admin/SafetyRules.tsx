import React, { useState, useEffect } from 'react';

interface SafetyRule {
  id: string;
  rule_name: string;
  rule_type: string;
  action: string;
  severity: string;
}

export const SafetyRules: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [rules, setRules] = useState<SafetyRule[]>([]);

  useEffect(() => {
    fetch(`/api/v1/ai/safety-rules/${tenantId}`)
      .then(r => r.json())
      .then(setRules)
      .catch(() => {});
  }, [tenantId]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Safety Rules</h2>
      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{rule.rule_name}</h3>
                <p className="text-sm text-gray-600">{rule.rule_type} - {rule.action}</p>
              </div>
              <span className={`rounded px-2 py-1 text-sm ${rule.severity === 'high' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {rule.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
