import React from 'react';
import { NavigationItem as NavigationItemType } from '../../api/navigation';

interface NavigationItemProps {
  item: NavigationItemType;
  depth?: number;
}

export const NavigationItem: React.FC<NavigationItemProps> = ({ item, depth = 0 }) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="navigation-item">
      <div
        className="flex items-center gap-2 rounded px-3 py-2 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && <span className="text-xs">{expanded ? '▼' : '▶'}</span>}
        {item.icon && <span>{item.icon}</span>}
        <span className="text-sm font-medium">{item.label}</span>
      </div>
      {hasChildren && expanded && (
        <div className="children">
          {item.children!.map((child) => (
            <NavigationItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
