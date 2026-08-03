import { useState, useEffect } from 'react';
import { api } from '../../api/templateOverrides';

interface InheritanceLevel {
  level: string;
  value: any;
  overridden: boolean;
}

interface TemplateInheritanceViewProps {
  templateType: string;
  templateKey: string;
  orgId: string;
}

export default function TemplateInheritanceView({ templateType, templateKey, orgId }: TemplateInheritanceViewProps) {
  const [chain, setChain] = useState<InheritanceLevel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!templateType || !templateKey) {
      setChain([]);
      return;
    }
    setLoading(true);
    api.getEffective('', templateType, templateKey, orgId)
      .then((data: any) => {
        const levels: InheritanceLevel[] = [
          { level: 'Platform Default', value: data.platformDefault, overridden: Boolean(data.platformOverridden) },
          { level: 'Industry', value: data.industryValue, overridden: Boolean(data.industryOverridden) },
          { level: 'Organization', value: data.orgValue, overridden: Boolean(data.orgOverridden) },
          { level: 'Role', value: data.roleValue, overridden: Boolean(data.roleOverridden) },
          { level: 'User', value: data.userValue, overridden: Boolean(data.userOverridden) },
        ];
        setChain(levels);
      })
      .catch(() => setChain([]))
      .finally(() => setLoading(false));
  }, [templateType, templateKey, orgId]);

  if (!templateType || !templateKey) {
    return (
      <div style={{ padding: 24, color: '#666' }}>
        Provide templateType and templateKey to view inheritance.
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 16 }}>Inheritance: {templateKey}</h3>
      {loading && <div style={{ color: '#666', marginBottom: 12 }}>Loading chain…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chain.map((level, index) => (
          <div
            key={level.level}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 14,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              backgroundColor: '#fff',
              position: 'relative',
            }}
          >
            {index < chain.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 40,
                  top: '100%',
                  width: 2,
                  height: 12,
                  backgroundColor: '#d1d5db',
                }}
              />
            )}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: level.overridden ? '#3b82f6' : '#9ca3af',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{level.level}</div>
              <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                {level.value !== null && level.value !== undefined ? String(level.value) : '—'}
              </div>
            </div>
            {level.overridden && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                }}
              >
                Overridden
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
