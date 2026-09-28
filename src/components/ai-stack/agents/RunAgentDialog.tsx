import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';

import { Button, Field, Modal, Select, Textarea } from '../../../ui';
import { AgentApiError, runAgent } from '../../../api/aiStack/agents';
import type { Agent, AgentRun } from '../../../api/aiStack/agentTypes';
import { findTool, type AgentTool } from '../agentRegistry';
import { useAiStackProfile } from '../profile-context';

import '../aiStack.css';
import '../aiStackScreens-b.css';

/**
 * Run one agent, once, now.
 *
 * v1 runs exactly one tool from the agent's allow-list with the arguments typed
 * here, so the operator sees precisely what will be logged before pressing Run.
 * The example arguments come from the tool registry; editing them is the whole
 * input surface for now.
 *
 * A refusal is shown with the `denied` run's id: the attempt was recorded.
 *
 * HP BRAIN PORT: the dialog is HP Brain's `Modal`, so Escape closes it, focus is
 * trapped inside and returns to the Run button afterwards.
 */
export function RunAgentDialog({ agent, onClose, onRan }: { agent: Agent; onClose: () => void; onRan: (run: AgentRun) => void }) {
  const profile = useAiStackProfile();
  const runnable = useMemo(
    () =>
      agent.tools_allowed
        .map((key) => findTool(profile.tools, key))
        .filter((tool): tool is AgentTool => Boolean(tool?.available)),
    [agent.tools_allowed, profile.tools],
  );
  const [toolKey, setToolKey] = useState(runnable[0]?.key ?? '');
  const [argsText, setArgsText] = useState(() => exampleFor(profile.tools, runnable[0]?.key ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentRun | null>(null);

  // The Modal re-runs its focus trap whenever `onClose` changes identity, and the
  // parents pass an inline arrow — so a refresh behind the dialog would pull focus
  // back to its first control. A stable callback keeps focus where the user left it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => onCloseRef.current(), []);

  // Reset the arguments whenever the tool changes; stale arguments for another tool
  // are worse than an empty form. Done in the change handler rather than an effect.
  const chooseTool = (key: string) => {
    setToolKey(key);
    setArgsText(exampleFor(profile.tools, key));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(argsText) as unknown;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Arguments must be a JSON object.');
      parsed = value as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Arguments must be valid JSON.');
      return;
    }

    setBusy(true);
    try {
      const run = await runAgent(agent.id, { tool: toolKey, arguments: parsed });
      setResult(run);
      onRan(run);
    } catch (cause) {
      if (cause instanceof AgentApiError && cause.run) {
        setError(`${cause.message} The attempt was recorded as ${cause.run.id}.`);
        onRan(cause.run);
      } else {
        setError(cause instanceof Error ? cause.message : 'The run failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      size="lg"
      title={`Run ${agent.name}`}
      description={`${agent.id} · ${agent.module} · runs under your user and is logged`}
    >
      <form onSubmit={submit} className="ais-form">
        {agent.instructions && (
          <p className="ais-b-callout">
            <span>
              <strong>Instructions: </strong>
              {agent.instructions}
            </span>
          </p>
        )}

        <Field label="Tool" error={!runnable.length ? 'This agent has no runnable tool on its allow-list.' : undefined}>
          <Select value={toolKey} onChange={(event) => chooseTool(event.target.value)} disabled={!runnable.length}>
            {runnable.map((tool) => (
              <option key={tool.key} value={tool.key}>
                {tool.label} ({tool.key})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Arguments (JSON)">
          <Textarea
            value={argsText}
            onChange={(event) => setArgsText(event.target.value)}
            rows={7}
            spellCheck={false}
            className="ais-b-mono-area"
          />
        </Field>

        <div aria-live="polite" className="ais-b-stack-sm">
          {error && (
            <p className="ais-b-callout ais-b-callout--error" role="alert">
              {error}
            </p>
          )}

          {result && (
            <div className={`ais-b-result ${result.status === 'success' ? 'ais-b-result--ok' : 'ais-b-result--warn'}`}>
              <p className="ais-b-strong" style={{ margin: 0, fontWeight: 700 }}>
                {result.status === 'success' ? 'Run completed' : 'Run failed'} ·{' '}
                <span className="ais-mono" style={{ fontWeight: 400 }}>
                  {result.id}
                </span>{' '}
                · {result.duration_ms} ms
              </p>
              {result.error && <p className="ais-b-warn ais-b-mt1" style={{ marginBottom: 0 }}>{result.error}</p>}
              {result.output && (
                <pre className="ais-pre">
                  {typeof result.output.message === 'string' ? result.output.message : JSON.stringify(result.output, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="ais-form-actions">
          <Button variant="secondary" size="sm" onClick={close}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={busy}
            disabled={!toolKey || agent.status !== 'active'}
            icon={<Play size={14} aria-hidden="true" />}
          >
            {busy ? 'Running…' : result ? 'Run again' : 'Run now'}
          </Button>
        </div>
        {agent.status !== 'active' && (
          <p className="ais-b-2xs ais-b-warn" style={{ margin: 0, textAlign: 'right' }}>
            Only active agents run. This one is {agent.status}.
          </p>
        )}
      </form>
    </Modal>
  );
}

function exampleFor(tools: AgentTool[], toolKey: string): string {
  return JSON.stringify(findTool(tools, toolKey)?.example_input ?? {}, null, 2);
}
