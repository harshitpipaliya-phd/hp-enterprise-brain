import { useState } from 'react';
import OrgUnitCard from './OrgUnitCard';

interface Props {
  orgId: string;
  units: any[];
  onUpdate: (units: any[]) => void;
}

interface DragState {
  draggingId: string | null;
  overId: string | null;
  position: 'before' | 'after' | 'inside' | null;
}

export default function OrgStructureBuilder({ units, onUpdate }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null, position: null });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragState((prev) => ({ ...prev, draggingId: id }));
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const position = e.clientY < mid ? 'before' : 'after';
    setDragState((prev) => ({ ...prev, overId: id, position }));
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) {
      setDragState({ draggingId: null, overId: null, position: null });
      return;
    }
    const next = units.filter((u) => u.id !== draggedId);
    const targetIndex = next.findIndex((u) => u.id === targetId);
    const insertIndex = dragState.position === 'before' ? targetIndex : targetIndex + 1;
    const unit = units.find((u) => u.id === draggedId)!;
    next.splice(insertIndex, 0, { ...unit, parentId: targetId });
    onUpdate(next);
    setDragState({ draggingId: null, overId: null, position: null });
  };

  const handleDragEnd = () => {
    setDragState({ draggingId: null, overId: null, position: null });
  };

  const rootUnits = units.filter((u) => !u.parentId);

  return (
    <div style={{ padding: 16 }}>
      {rootUnits.map((unit) => (
        <div key={unit.id} style={{ marginBottom: 8 }}>
          <div
            draggable
            onDragStart={(e) => handleDragStart(e, unit.id)}
            onDragOver={(e) => handleDragOver(e, unit.id)}
            onDrop={(e) => handleDrop(e, unit.id)}
            onDragEnd={handleDragEnd}
            style={{ cursor: 'grab', opacity: dragState.draggingId === unit.id ? 0.5 : 1 }}
          >
            <OrgUnitCard
              unit={unit}
              onEdit={() => {}}
              onDelete={() => {}}
              onAddChild={() => {}}
              children={units.filter((u) => u.parentId === unit.id)}
              expanded={!!expanded[unit.id]}
              onToggleExpand={() => toggleExpand(unit.id)}
            />
          </div>
          {expanded[unit.id] && units.filter((u) => u.parentId === unit.id).length > 0 && (
            <div style={{ marginLeft: 24, marginTop: 8 }}>
              {units
                .filter((u) => u.parentId === unit.id)
                .map((child) => (
                  <div
                    key={child.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, child.id)}
                    onDragOver={(e) => handleDragOver(e, child.id)}
                    onDrop={(e) => handleDrop(e, child.id)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: 'grab', opacity: dragState.draggingId === child.id ? 0.5 : 1, marginBottom: 8 }}
                  >
                    <OrgUnitCard
                      unit={child}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onAddChild={() => {}}
                      children={units.filter((u) => u.parentId === child.id)}
                      expanded={!!expanded[child.id]}
                      onToggleExpand={() => toggleExpand(child.id)}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
      {units.length === 0 && <div style={{ padding: 16, color: '#888' }}>No units defined.</div>}
    </div>
  );
}
