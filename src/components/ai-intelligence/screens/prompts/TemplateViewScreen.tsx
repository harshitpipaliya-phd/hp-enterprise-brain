import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Pencil } from 'lucide-react';

import { Button } from '../../../../ui';
import { describeAiError } from '../../../../api/aiIntelligence/client';
import { fetchTemplate, isPlatformTemplate, type AiTemplateRow } from '../../../../api/aiIntelligence/templates';
import { useConsoleNav } from '../../consoleNav';
import { PlatformBadge, TemplatePageShell, TemplatePageState } from './TemplateForm';
import './prompts.css';

/**
 * View Template — the whole template, read-only, on its own screen. Ported from
 * G2G's app/ai/prompts/[id]/page.tsx and app/ai/_components/TemplateView.tsx.
 *
 * Separate from the editor rather than the editor with its inputs disabled: a reader's
 * question is "what does this template do", and a form answers "what could I change".
 */
export default function TemplateViewScreen({ id }: { id: string }) {
  const { go } = useConsoleNav();

  const [row, setRow] = useState<AiTemplateRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetchTemplate(id)
      .then((data) => {
        if (!cancelled) setRow(data.template);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeAiError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <TemplatePageShell
      title="View Template"
      subtitle={
        row
          ? `${row.module_label} · ${row.status} · version ${row.version}`
          : 'The complete template as it is stored.'
      }
      actions={
        <div className="aii-row">
          <Button onClick={() => go('prompts')} icon={<ArrowLeft size={16} aria-hidden="true" />}>
            Back to templates
          </Button>
          {row && (
            <Button
              variant="primary"
              onClick={() => go(`prompts/${row.id}/edit`)}
              icon={<Pencil size={16} aria-hidden="true" />}
            >
              {row.editable_in_place ? 'Edit' : 'Customise'}
            </Button>
          )}
        </div>
      }
    >
      {row === null ? (
        <TemplatePageState loading={error === ''} error={error} />
      ) : (
        <TemplateView row={row} onEdit={() => go(`prompts/${row.id}/edit`)} />
      )}
    </TemplatePageShell>
  );
}

/**
 * The View screen's body — the whole template, read-only.
 *
 * WHY IT IS NOT THE FORM WITH THE INPUTS DISABLED
 *
 * A disabled form answers "what could I change" when the question is "what does this
 * template do". Fields that matter to a reader — which module offers it, whether it is
 * live, which placeholders it actually uses — are laid out as facts here, and the two
 * prompts are shown as the text they are rather than in boxes that look editable and
 * are not.
 *
 * It also surfaces the two things the listing can only hint at: the placeholders the
 * prompt uses that nothing will fill, and whether the template carries a grounding
 * variable at all. Both are the difference between a template that works and one that
 * quietly invents its answer.
 */
function TemplateView({ row, onEdit }: { row: AiTemplateRow; onEdit: () => void }) {
  const platform = isPlatformTemplate(row);
  const grounding = row.grounding_variables ?? [];
  const unresolved = row.unresolvable_variables ?? [];
  const rules = Array.isArray(row.safety_rules) ? row.safety_rules : [];

  return (
    <div className="aii-stack">
      <section className="aii-card aii-card--flush">
        <header className="aii-card-head tpl-view-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="aii-row tpl-view-name">
              {row.name}
              {platform && <PlatformBadge />}
            </h2>
            <p className="aii-mono aii-muted tpl-view-key">{row.template_key}</p>
          </div>
          <Button size="sm" onClick={onEdit} icon={<Pencil size={14} aria-hidden="true" />}>
            {row.editable_in_place ? 'Edit' : 'Customise'}
          </Button>
        </header>

        <dl className="tpl-facts">
          <Fact label="Module Name" value={row.module_label} />
          <Fact label="Category" value={row.category ?? 'Uncategorised'} />
          <Fact label="Status" value={`${row.status} · v${row.version}`} />
          <Fact label="Owner" value={platform ? 'Platform (shared)' : 'This organisation'} />
          <Fact label="Output format" value={row.output_format} />
          <Fact
            label="In module"
            value={row.offered_in_module ? `Offered as “${row.offer_label}”` : 'Not offered'}
          />
          <Fact label="Human review" value={row.requires_review ? 'Required' : 'Not required'} />
          <Fact label="Usable as evidence" value={row.allow_as_evidence ? 'Allowed' : 'Not allowed'} />
        </dl>

        {row.description && <p className="tpl-view-desc">{row.description}</p>}
      </section>

      {/* Stated plainly rather than left for the reader to work out by eye: whether the
          prompt carries data, and whether any placeholder in it is a dead letter. */}
      <section className="aii-stack tpl-callouts">
        {grounding.length > 0 ? (
          <p className="tpl-callout tpl-callout--ok">
            <Check size={16} aria-hidden="true" />
            <span>
              Grounded on {grounding.map((key) => `{{${key}}}`).join(' and ')} — the
              model answers from the data on screen.
            </span>
          </p>
        ) : (
          <p className="tpl-callout tpl-callout--warn">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              No data variable. The model has nothing to work from and will answer from general
              knowledge.
            </span>
          </p>
        )}

        {unresolved.length > 0 && (
          <p className="tpl-callout tpl-callout--warn">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              Nothing fills {unresolved.map((key) => `{{${key}}}`).join(', ')} — the
              model receives that text literally.
            </span>
          </p>
        )}
      </section>

      <section className="aii-card aii-card--flush">
        <h3 className="aii-card-head aii-card-title">Prompt Content</h3>

        <div className="tpl-view-prompt">
          <span className="tpl-eyebrow">System instruction</span>
          <pre className="tpl-view-pre aii-muted">
            {row.system_prompt || 'None — the template relies on the user prompt alone.'}
          </pre>
        </div>

        <div className="tpl-view-prompt">
          <span className="tpl-eyebrow">User prompt</span>
          <pre className="tpl-view-pre">{row.user_prompt}</pre>
        </div>
      </section>

      {rules.length > 0 && (
        <section className="aii-card aii-card--flush">
          <h3 className="aii-card-head aii-card-title">Safety rules</h3>
          <ul className="tpl-view-rules">
            {rules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tpl-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
