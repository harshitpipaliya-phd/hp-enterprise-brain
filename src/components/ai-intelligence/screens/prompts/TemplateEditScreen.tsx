import { useEffect, useState } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';

import { Button } from '../../../../ui';
import { describeAiError } from '../../../../api/aiIntelligence/client';
import { fetchTemplate, isPlatformTemplate, type AiTemplateRow } from '../../../../api/aiIntelligence/templates';
import { useConsoleNav } from '../../consoleNav';
import {
  formFromRow,
  TemplateForm,
  TemplatePageShell,
  TemplatePageState,
  useTemplateOptions,
  type TemplateFormState,
} from './TemplateForm';
import './prompts.css';

/**
 * Edit Template — the editor, on its own screen. Ported from G2G's
 * app/ai/prompts/[id]/edit/page.tsx.
 *
 * Module Name and Template Title sit side by side, the content block full width
 * below with its toolbar strip, Save and Cancel underneath. See `TemplateForm` for
 * why the toolbar carries the variable picker and Preview but no bold, font or
 * colour controls.
 *
 * Cancel and a successful save both return to the listing rather than to the View
 * screen, because the listing is where the administrator came from and where the
 * next template is.
 */
export default function TemplateEditScreen({ id }: { id: string }) {
  const { go } = useConsoleNav();

  const { options, optionsError } = useTemplateOptions();
  const [row, setRow] = useState<AiTemplateRow | null>(null);
  const [initial, setInitial] = useState<TemplateFormState | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchTemplate(id)
      .then((data) => {
        if (cancelled) return;
        setRow(data.template);
        setInitial(formFromRow(data.template));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const failure = error || optionsError;

  return (
    <TemplatePageShell
      title={row && !row.editable_in_place ? 'Customise Template' : 'Edit Template'}
      subtitle={
        row
          ? `${row.name} — ${row.module_label} · version ${row.version}`
          : 'Change what this template asks the model to do.'
      }
      actions={
        <div className="aii-row">
          <Button onClick={() => go('prompts')} icon={<ArrowLeft size={16} aria-hidden="true" />}>
            Back to templates
          </Button>
          {row && (
            <Button onClick={() => go(`prompts/${row.id}`)} icon={<Eye size={16} aria-hidden="true" />}>
              View
            </Button>
          )}
        </div>
      }
    >
      {options === null || initial === null || row === null ? (
        <TemplatePageState loading={failure === ''} error={failure} />
      ) : (
        <div className="aii-card">
          <TemplateForm
            // Keyed on the row so arriving at another template's editor starts from
            // that template's values rather than the previous one's.
            key={row.id}
            options={options}
            initial={initial}
            templateId={row.id}
            editableInPlace={row.editable_in_place}
            isPlatform={isPlatformTemplate(row)}
            returnTo="prompts"
          />
        </div>
      )}
    </TemplatePageShell>
  );
}
