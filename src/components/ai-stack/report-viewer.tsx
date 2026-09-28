/**
 * A report built from a module's AI Stack: read it, edit it, refresh its figures, print it,
 * copy its reference. Ported from G2G's app/ai/reports/[id]/page.tsx (itself a port of
 * LMS_K12's `/ai-reports/[id]` page).
 *
 * Same behaviour, same safety: the document is admin-editable HTML, so it is shown inside
 * a sandboxed frame with scripts disallowed and is never injected into this app's DOM.
 * `allow-same-origin` is there so Print can reach the frame; `allow-modals` is kept from
 * G2G because browsers refuse `print()` from a sandboxed frame without it. Neither lets a
 * script run — there is no `allow-scripts`.
 *
 * WHERE THIS LIVES IN HP BRAIN
 *
 * G2G opens a built report at its own URL, `/ai/reports/{id}`. HP Brain has no router and
 * no such route, and the AI Stack inside a module never sends anybody to the centralized
 * AI & Intelligence console — so the viewer opens INSIDE the module's Templates tab, and
 * `onClose` returns to it. For the same reason "Copy link" copies the report's id rather
 * than a URL: there is no address a report can be reopened from.
 *
 * NOT PORTED: "Send". LMS_K12 emails each person in a report their own figures, resolved
 * through its student/guardian recipient model. Neither G2G nor HP Brain has an equivalent
 * recipient model, so there is no Send button rather than one that could email the wrong
 * people. Everything else on the page is here.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Pencil, Printer, RefreshCw, Save, X } from 'lucide-react';

import { Button, ConfirmationDialog, Field, TextInput } from '../../ui';
import { TemplateHtmlEditor } from './adapters/template-html-editor';
import { describeAiError } from '../../api/aiIntelligence/client';
import { getAiReport, regenerateAiReport, saveAiReport, type AiReport } from '../../api/aiStack/reports';
import { AiStackLoading } from './ai-stack-chrome';
import './aiStackScreens-a.css';

const FRAME_STYLES = `
  @page { margin: 16mm; }
  html { background: #fff; }
  body {
    margin: 0; padding: 24px;
    font: 14px/1.6 Inter, "Segoe UI", system-ui, sans-serif;
    color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h2 { margin: 0 0 8px; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  small { color: #64748b; }
  @media print { body { padding: 0; } }
`;

function frameDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Report</title><style>${FRAME_STYLES}</style></head><body>${html}</body></html>`;
}

function formatMoment(iso: string): string {
  const parsed = new Date(iso.replace(' ', 'T'));

  if (Number.isNaN(parsed.getTime())) return iso;

  return parsed.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InlineMessage({ type, text }: { type: 'error' | 'success'; text: string }) {
  return (
    <p
      className={`ais-a-callout ${type === 'error' ? 'ais-a-callout--error' : 'ais-a-callout--success'}`}
      role={type === 'error' ? 'alert' : undefined}
    >
      {text}
    </p>
  );
}

export function AiStackReportViewer({ id, onClose }: { id: string; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reportId = id.trim();
  const malformedId = reportId === '';

  const [report, setReport] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'saving' | 'refreshing' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  /** What to do once the person agrees to discard unsaved edits. */
  const [discardThen, setDiscardThen] = useState<'cancel' | 'close' | null>(null);

  // The viewer replaces the tab's content, so focus is moved onto its heading: a keyboard
  // or screen-reader user would otherwise be left on a button that is no longer shown.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (malformedId) return;

    let cancelled = false;

    (async () => {
      try {
        const { report: loaded } = await getAiReport(reportId);
        if (cancelled) return;
        setReport(loaded);
        setDraftTitle(loaded.title);
        setDraftHtml(loaded.html);
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(describeAiError(caught, 'This report could not be opened.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reportId, malformedId]);

  const dirty = Boolean(report) && (draftTitle !== report?.title || draftHtml !== report?.html);

  const save = useCallback(async () => {
    if (!report) return;

    if (!draftTitle.trim()) {
      setError('A report needs a title.');
      return;
    }

    setBusy('saving');
    setError(null);
    setNotice(null);

    try {
      const { report: saved } = await saveAiReport(report.id, { title: draftTitle.trim(), html: draftHtml });
      setReport({ ...report, title: saved.title, html: draftHtml, figures: saved.figures });
      setDraftTitle(saved.title);
      setEditing(false);
      setNotice('Report saved.');
    } catch (caught) {
      setError(describeAiError(caught, 'The report could not be saved.'));
    } finally {
      setBusy(null);
    }
  }, [report, draftTitle, draftHtml]);

  const refresh = useCallback(async () => {
    if (!report) return;

    setBusy('refreshing');
    setError(null);
    setNotice(null);

    try {
      const result = await regenerateAiReport(report.id);
      setReport({ ...report, html: result.html });
      setDraftHtml(result.html);
      setNotice(`Figures refreshed — ${result.row_count} row${result.row_count === 1 ? '' : 's'} read from live ${result.module} records.`);
    } catch (caught) {
      setError(describeAiError(caught, 'The figures could not be refreshed.'));
    } finally {
      setBusy(null);
    }
  }, [report]);

  const print = useCallback(() => {
    const frame = frameRef.current?.contentWindow;

    if (!frame) {
      setError('The report could not be prepared for printing.');
      return;
    }

    frame.focus();
    frame.print();
  }, []);

  // HP Brain has no URL for a report, so the reference that identifies it is its id.
  const copyReference = useCallback(async () => {
    setError(null);

    try {
      await navigator.clipboard.writeText(report?.id ?? reportId);
      setNotice('Report id copied. Anyone you send it to will need administrator access to this organisation.');
    } catch {
      setError(`The report id could not be copied. It is ${report?.id ?? reportId}.`);
    }
  }, [report, reportId]);

  const discardEdits = useCallback(() => {
    setDraftTitle(report?.title ?? '');
    setDraftHtml(report?.html ?? '');
    setEditing(false);
    setError(null);
  }, [report]);

  const cancel = useCallback(() => {
    if (dirty) {
      setDiscardThen('cancel');
      return;
    }

    discardEdits();
  }, [dirty, discardEdits]);

  const close = useCallback(() => {
    if (editing && dirty) {
      setDiscardThen('close');
      return;
    }

    onClose();
  }, [editing, dirty, onClose]);

  const confirmDiscard = () => {
    const then = discardThen;
    setDiscardThen(null);
    discardEdits();
    if (then === 'close') onClose();
  };

  return (
    <div className="ais-a-viewer">
      <div>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={close}>
          Back to templates
        </Button>
      </div>

      <div className="ais-a-viewer-head">
        <div className="ais-minw0">
          <h2 ref={headingRef} tabIndex={-1} className="ais-a-viewer-title">
            {report?.title || 'Report'}
          </h2>
          <p className="ais-a-viewer-sub">
            {report?.figures
              ? `Figures read from live ${report.figures.module} records via ${report.figures.source} · ${formatMoment(report.figures.generated_at)}`
              : 'Generated report'}
          </p>
        </div>

        {report ? (
          <div className="ais-a-actions">
            {editing ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => void save()}
                  disabled={busy !== null || !dirty}
                  loading={busy === 'saving'}
                  icon={busy === 'saving' ? undefined : <Save size={16} aria-hidden="true" />}
                >
                  Save changes
                </Button>
                <Button
                  variant="secondary"
                  onClick={cancel}
                  disabled={busy !== null}
                  icon={<X size={16} aria-hidden="true" />}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)} icon={<Pencil size={16} aria-hidden="true" />}>
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void refresh()}
                  disabled={busy !== null || !report.figures}
                  loading={busy === 'refreshing'}
                  title="Re-read the live records. Anything written around the table is kept."
                  icon={busy === 'refreshing' ? undefined : <RefreshCw size={16} aria-hidden="true" />}
                >
                  Refresh figures
                </Button>
                <Button variant="secondary" onClick={print} icon={<Printer size={16} aria-hidden="true" />}>
                  Print
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void copyReference()}
                  icon={<Copy size={16} aria-hidden="true" />}
                >
                  Copy report id
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {malformedId ? <InlineMessage type="error" text="That is not a valid report reference." /> : null}
      {error ? <InlineMessage type="error" text={error} /> : null}
      <div aria-live="polite" className="ais-a-live">
        {notice ? <InlineMessage type="success" text={notice} /> : null}
      </div>

      {loading && !malformedId ? <AiStackLoading label="Opening the report…" /> : null}

      {!loading && report ? (
        <div className="ais-card">
          {editing ? (
            <div className="ais-a-viewer-edit">
              <p className="ais-a-body">
                The figures were composed from real records. Refreshing replaces the table and keeps anything you write
                around it.
              </p>
              <Field label="Report title">
                <TextInput
                  id={`ai-report-title-${reportId}`}
                  value={draftTitle}
                  maxLength={250}
                  onChange={(event) => setDraftTitle(event.target.value)}
                />
              </Field>
              <div>
                <span className="ais-a-editor-label">Document</span>
                <TemplateHtmlEditor value={draftHtml} onChange={setDraftHtml} tags={[]} disabled={busy !== null} />
              </div>
            </div>
          ) : (
            <div className="ais-a-frame-wrap">
              <iframe
                ref={frameRef}
                title={report.title || 'Report'}
                srcDoc={frameDocument(report.html)}
                sandbox="allow-same-origin allow-modals"
                className="ais-a-frame"
              />
            </div>
          )}
        </div>
      ) : null}

      {!loading && !report && !error && !malformedId ? (
        <div className="ais-loading">
          <Check size={16} aria-hidden="true" />
          There is nothing to show for this report.
        </div>
      ) : null}

      <ConfirmationDialog
        open={discardThen !== null}
        onCancel={() => setDiscardThen(null)}
        onConfirm={confirmDiscard}
        title="Discard the changes to this report?"
        description="The title and document go back to the last saved version."
        confirmLabel="Discard"
        destructive
      />
    </div>
  );
}
