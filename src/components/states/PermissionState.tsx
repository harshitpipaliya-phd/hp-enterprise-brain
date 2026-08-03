import React from 'react';

interface PermissionStateProps {
  requiredPermission?: string;
}

export const PermissionState: React.FC<PermissionStateProps> = ({ requiredPermission }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 text-6xl">🔒</span>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">Permission Denied</h3>
      <p className="max-w-md text-sm text-gray-500">
        You don't have permission to access this resource.
        {requiredPermission && <span className="block mt-1 text-xs">Required: {requiredPermission}</span>}
      </p>
    </div>
  );
};
