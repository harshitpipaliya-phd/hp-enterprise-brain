import React from 'react';
import { Sparkles } from 'lucide-react';

import { Spinner } from '../../ui';
import { canUseAiStack } from './adapters/use-permission';
import { AI_STACK_VIEWS } from './moduleViews';
import './aiStack.css';

const ModuleAiStackPanel = React.lazy(() => import('./ModuleAiStackPanel'));

/**
 * The module/AI Stack switch G2G puts beside a module's own view ("Library | AI Stack",
 * "List | Board | AI Stack"), applied to an HP Brain screen from outside it.
 *
 * WHY A FRAME AND NOT AN EDIT TO EIGHTEEN SCREENS. Every HP Brain screen owns its own
 * header, and threading a toggle through each would touch eighteen working screens for
 * one button. The frame sits directly above the screen instead, so the screens are
 * unchanged and cannot regress.
 *
 * The module view stays MOUNTED while the AI Stack is open (hidden, not unmounted), so
 * switching back returns to exactly the filters, selection and scroll the user left.
 *
 * Offered only to the roles that hold settings.manage, the same rule the API enforces;
 * for everyone else, and on screens without an AI Stack, this renders the screen alone.
 */
export function ModuleAiStackFrame({
  view,
  userRole,
  children,
}: {
  view: string;
  userRole: string | null;
  children: React.ReactNode;
}) {
  const entry = AI_STACK_VIEWS[view];
  const [open, setOpen] = React.useState(false);

  if (!entry || !canUseAiStack(userRole)) return <>{children}</>;

  return (
    <>
      <div className="ais-toggle-bar">
        <div className="ais-toggle" role="group" aria-label={`${entry.label} view`}>
          <button type="button" className="ais-toggle-btn" aria-pressed={!open} onClick={() => setOpen(false)}>
            {entry.label}
          </button>
          <button type="button" className="ais-toggle-btn" aria-pressed={open} onClick={() => setOpen(true)}>
            <Sparkles size={14} aria-hidden="true" />
            AI Stack
          </button>
        </div>
      </div>

      <div hidden={open}>{children}</div>

      {open && (
        <React.Suspense fallback={<Spinner label={`Loading the ${entry.label} AI Stack`} />}>
          <ModuleAiStackPanel moduleKey={entry.key} />
        </React.Suspense>
      )}
    </>
  );
}
