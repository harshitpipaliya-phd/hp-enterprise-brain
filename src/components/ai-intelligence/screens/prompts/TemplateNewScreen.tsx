import { ArrowLeft } from 'lucide-react';

import { Button } from '../../../../ui';
import { useConsoleNav } from '../../consoleNav';
import {
  blankForm,
  TemplateForm,
  TemplatePageShell,
  TemplatePageState,
  useTemplateOptions,
} from './TemplateForm';
import './prompts.css';

/**
 * Add Template — its own screen, not a panel under the listing. Ported from G2G's
 * app/ai/prompts/new/page.tsx.
 *
 * The console route 'prompts/new' is matched before 'prompts/<id>', so it can never
 * be read as a template whose id is the word "new".
 *
 * '?module=<key>' carries the listing's selected module in (as `initialModule`), so
 * adding a template from one module's view files it under that module without the
 * author re-choosing what they had already chosen.
 */
export default function TemplateNewScreen({ initialModule }: { initialModule?: string }) {
  const { go } = useConsoleNav();
  const { options, optionsError } = useTemplateOptions();

  const moduleKey = initialModule ?? '';
  const returnTo = 'prompts';

  return (
    <TemplatePageShell
      title="Add Template"
      subtitle="Write an AI template and file it under the module that will use it."
      actions={<BackToTemplates onClick={() => go(returnTo)} />}
    >
      {options === null ? (
        <TemplatePageState loading={optionsError === ''} error={optionsError} />
      ) : (
        <div className="aii-card">
          <TemplateForm
            options={options}
            initial={blankForm(moduleKey)}
            templateId={null}
            returnTo={returnTo}
          />
        </div>
      )}
    </TemplatePageShell>
  );
}

function BackToTemplates({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} icon={<ArrowLeft size={16} aria-hidden="true" />}>
      Back to templates
    </Button>
  );
}
