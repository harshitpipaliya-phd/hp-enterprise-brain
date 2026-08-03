import React, { useState, useEffect } from 'react';

interface Evaluation {
  id: string;
  evaluation_name: string;
  status: string;
  model: string;
}

export const EvaluationDashboard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  useEffect(() => {
    fetch(`/api/v1/ai/evaluations/${tenantId}`)
      .then(r => r.json())
      .then(setEvaluations)
      .catch(() => {});
  }, [tenantId]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">AI Evaluations</h2>
      <div className="space-y-4">
        {evaluations.map((evaluation) => (
          <div key={evaluation.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{evaluation.evaluation_name}</h3>
                <p className="text-sm text-gray-600">Model: {evaluation.model || 'N/A'}</p>
              </div>
              <span className={`rounded px-2 py-1 text-sm ${evaluation.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {evaluation.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
