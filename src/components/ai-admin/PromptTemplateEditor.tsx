import React, { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  prompt_key: string;
  version: number;
  status: string;
}

export const PromptTemplateEditor: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    fetch(`/api/v1/ai/prompt-templates/${tenantId}`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, [tenantId]);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">Prompt Templates</h2>
      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-sm text-gray-600">v{template.version} - {template.prompt_key}</p>
              </div>
              <span className={`rounded px-2 py-1 text-sm ${template.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {template.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
