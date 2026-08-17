import React from 'react';
import { Lock } from 'lucide-react';
import { PermissionDeniedState } from '../../ui';

interface PermissionStateProps {
  requiredPermission?: string;
}

export const PermissionState: React.FC<PermissionStateProps> = ({ requiredPermission }) => {
  return (
    <div className="u-state-shell">
      <PermissionDeniedState requiredPermission={requiredPermission} />
      <div className="u-sr-only" aria-hidden="true">
        <Lock />
      </div>
    </div>
  );
};
