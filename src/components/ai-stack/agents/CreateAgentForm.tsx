import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';

import { Button, Checkbox, Field, Select, TextInput, Textarea } from '../../../ui';
import { createAgent } from '../../../api/aiStack/agents';
import type { Agent } from '../../../api/aiStack/agentTypes';
import { usePermission } from '../adapters/use-permission';
import { AGENT_MODULES, findModule, rbacModuleKey, toolsForModule, type AgentTool } from '../agentRegistry';
import { useAiStackProfile } from '../profile-context';

import { Card } from './primitives';

/**
 * Create Agent.
 *
 * The module selector comes first because everything below it depends on it:
 * the tools offered are the selected module's plus the shared ones, and the
 * create button is gated on `agents.<module>` create rights. Changing the module
 * clears the tool selection so one module's tool cannot survive a switch to
 * another.
 *
 * The permission hook is advisory — it disables the button and says why. The
 * server checks again on submit, so a client that ignores this gains nothing.
 *
 * HP BRAIN PORT: G2G offers an `AiFieldAssistant` ("draft with AI") beside the
 * Description and Instructions fields. HP Brain has no such component, so the
 * two fields are plain labelled inputs; nothing else about the form changed.
 */
export function CreateAgentForm({
  lockedModule,
  onCreated,
}: {
  /** When set (a module's own screen), the selector is fixed to this module. */
  lockedModule?: string;
  onCreated: (agent: Agent) => void;
}) {
  const [module, setModule] = useState(lockedModule ?? AGENT_MODULES[0]?.key ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [activate, setActivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = useAiStackProfile();
  const offered = useMemo(() => toolsForModule(profile.tools, module), [profile.tools, module]);
  const canCreate = usePermission(rbacModuleKey(module), 'create');
  const moduleLabel = findModule(module)?.label ?? module;

  const changeModule = (next: string) => {
    setModule(next);
    setTools([]);
  };

  const toggleTool = (tool: AgentTool) => {
    if (!tool.available) return;
    setTools((current) => (current.includes(tool.key) ? current.filter((key) => key !== tool.key) : [...current, tool.key]));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const agent = await createAgent({
        name,
        description,
        module,
        tools_allowed: tools,
        instructions,
        status: activate ? 'active' : 'draft',
      });
      setName('');
      setDescription('');
      setInstructions('');
      setTools([]);
      onCreated(agent);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The agent could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const rightsNote =
    canCreate === undefined
      ? 'Checking your rights…'
      : canCreate
        ? null
        : `Your role cannot create agents for ${moduleLabel}. Ask an administrator for ${rbacModuleKey(module)} create rights.`;

  return (
    <form onSubmit={submit} className="ais-b-create" aria-label="Create agent">
      <Card className="ais-b-card-pad">
        <div className="ais-form-grid">
          <div className="ais-b-span-all">
            <Field
              label="Module"
              help={`${findModule(module)?.description ?? ''} Rights are checked against ${rbacModuleKey(module)}.`.trim()}
            >
              <Select value={module} onChange={(event) => changeModule(event.target.value)} disabled={Boolean(lockedModule)}>
                {AGENT_MODULES.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Name" required>
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              placeholder={`${moduleLabel} summariser`}
            />
          </Field>

          <Field label="Description">
            <TextInput
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this agent is for, in one line"
            />
          </Field>

          <div className="ais-b-span-all">
            <Field label="Instructions" help="Kept with the agent and shown to whoever runs it. Not sent to a model in v1.">
              <Textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                rows={3}
                placeholder="Summarise what the records show in plain language. Never name a person unless asked."
              />
            </Field>
          </div>
        </div>

        <fieldset className="ais-b-fieldset">
          <legend className="ais-b-legend">Tools allowed</legend>
          <p className="ais-b-2xs" style={{ margin: '0 0 var(--space-2)' }}>
            Only {moduleLabel} tools and shared tools are offered. Greyed tools have no executor yet.
          </p>
          {offered.length === 0 ? (
            <p className="ais-b-xs" style={{ margin: 0 }}>
              No tools are registered for {moduleLabel}, so an agent cannot be created for it yet.
            </p>
          ) : (
            <div className="ais-b-tools">
              {offered.map((tool) => {
                const checked = tools.includes(tool.key);
                return (
                  <label
                    key={tool.key}
                    className={`ais-b-tool${!tool.available ? ' ais-b-tool--disabled' : checked ? ' ais-b-tool--checked' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!tool.available}
                      onChange={() => toggleTool(tool)}
                    />
                    <span className="ais-minw0">
                      <span className="ais-b-tool-name">
                        {tool.label}
                        <RiskPill risk={tool.risk} />
                        {tool.module === 'shared' && <span className="ais-b-tag">shared</span>}
                        {!tool.available && <span className="ais-b-tag">not yet available</span>}
                      </span>
                      <span className="ais-b-xs" style={{ display: 'block' }}>
                        {tool.description}
                      </span>
                      <span className="ais-mono ais-b-3xs" style={{ display: 'block' }}>
                        {tool.key}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </Card>

      <Card className="ais-b-card-pad ais-b-create-review">
        <p className="ais-b-legend" style={{ margin: 0 }}>
          Review
        </p>
        <dl className="ais-b-stack-xs ais-b-mt2" style={{ marginBottom: 0 }}>
          <Row label="Module" value={moduleLabel} />
          <Row label="Tools" value={tools.length ? `${tools.length} selected` : 'None yet'} />
          <Row label="Trigger" value="Manual (a person presses Run)" />
          <Row label="Runs as" value="The signed-in user who presses Run" />
        </dl>

        <div className="ais-b-mt4">
          <Checkbox label="Activate on save" checked={activate} onChange={(event) => setActivate(event.target.checked)} />
        </div>

        <div aria-live="polite">
          {rightsNote && (
            <p className="ais-b-callout ais-b-callout--warning ais-b-mt4">
              <Lock size={14} aria-hidden="true" />
              {rightsNote}
            </p>
          )}
          {error && (
            <p className="ais-b-callout ais-b-callout--error ais-b-mt4" role="alert">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          block
          className="ais-b-mt4"
          loading={busy}
          disabled={!name.trim() || !tools.length || canCreate !== true}
        >
          {busy ? 'Creating…' : 'Create agent'}
        </Button>
      </Card>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ais-b-review-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function RiskPill({ risk }: { risk: AgentTool['risk'] }) {
  return <span className={`ais-b-risk ais-b-risk--${risk}`}>{risk}</span>;
}
