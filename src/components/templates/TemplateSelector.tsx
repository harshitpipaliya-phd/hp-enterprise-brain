import { useState, useEffect } from 'react';
import { listIndustryTemplates } from '../../api/industryTemplates';

export interface Template {
  id: string;
  name: string;
  description: string;
  industryCode: string;
}

interface TemplateSelectorProps {
  industryCode: string;
  onSelect: (template: any) => void;
  selectedTemplate?: any;
}

export default function TemplateSelector({ industryCode, onSelect, selectedTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!industryCode) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    listIndustryTemplates(industryCode)
      .then((data: any[]) => setTemplates(data))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [industryCode]);

  if (!industryCode) {
    return (
      <div style={{ padding: 24, color: '#666' }}>
        Select an industry to view available templates.
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 16 }}>Templates for {industryCode}</h3>
      {loading && <div style={{ color: '#666', marginBottom: 12 }}>Loading templates…</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {templates.map((template) => (
          <div
            key={template.id}
            onClick={() => onSelect(template)}
            style={{
              padding: 16,
              border: `2px solid ${selectedTemplate?.id === template.id ? 'var(--chart-1)' : 'var(--border-default)'}`,
              borderRadius: 8,
              backgroundColor: selectedTemplate?.id === template.id ? 'var(--action-subtle)' : '#fff',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{template.name}</div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.4 }}>{template.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
