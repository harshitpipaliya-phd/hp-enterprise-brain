import React from 'react';
import { NavigationItem } from './NavigationItem';
import { useFeatureFlag } from '../../contexts/FeatureFlagContext';

interface DynamicNavigationProps {
  items: any[];
  enabledModules: string[];
}

export const DynamicNavigation: React.FC<DynamicNavigationProps> = ({ items, enabledModules }) => {
  const { isEnabled } = useFeatureFlag();

  const filtered = items.filter((item) => {
    if (item.required_module && !enabledModules.includes(item.required_module)) return false;
    if (item.required_flag && !isEnabled(item.required_flag)) return false;
    return true;
  });

  return (
    <nav className="space-y-1">
      {filtered.map((item) => (
        <NavigationItem key={item.id} item={item} />
      ))}
    </nav>
  );
};
