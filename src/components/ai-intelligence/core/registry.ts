/**
 * The AI & Intelligence capability registry — one description of each capability,
 * shared by every product that consumes it.
 *
 * WHY THIS FILE EXISTS
 *
 * The twelve AI & Intelligence entries began life as a hard-coded array of labels in
 * a header component and a second hard-coded map of routes beside it, most of them
 * pointing at a generic "under construction" placeholder. So the menu knew a name and
 * nothing else: not what the capability is for, not whether it is built, not which
 * products it serves. Nothing else in the codebase could ask.
 *
 * That is the thing standing between these menus and being shared. A menu that is a
 * list of strings can only ever be copied into the next product; a menu that is a
 * list of records can be imported. This file is that list of records, and it lives in
 * `packages/` rather than `lib/` for exactly that reason — it must not depend on any
 * one product's `app/`.
 *
 * ── HOW THIS COPY RELATES TO G2G's AND LMS K-12's ─────────────────────────
 *
 * HP Brain is a separate repository with no shared package tooling, so it carries a
 * copy of packages/ai-intelligence-core rather than importing it. The capability set
 * is identical, deliberately and permanently: same twelve ids, same slugs, same
 * names, same order, same purpose sentences. Renaming a capability here without
 * renaming it there would be a bug rather than a divergence.
 *
 * What differs, and must:
 *
 *   `status`, `todayHere`   what HP Brain actually offers today, from its own tables.
 *
 *   `solutions`   the per-product consumption states. HP Brain's entries are written
 *                 from what this codebase does.
 *
 *   `route`, `openView`   HP Brain-only. It has no URL router, so a capability names
 *                 a console sub-route or an existing HP Brain view instead of an href.
 *
 * STATUS IS ABOUT THIS PRODUCT, AND IS NEVER OPTIMISTIC
 *
 * Three words, and each one is a claim someone can check by opening the screen.
 * Never mark something `coming-soon` that already works, and never mark something
 * `live` because its tables exist — `hpbrain_knowledge_assets` exists and holds six
 * rows with no ingestion pipeline behind them, which is why Knowledge & RAG is
 * `in-progress` rather than `live`.
 */

import type { SolutionId } from './solutions'

/**
 * What state a capability is in.
 *
 * Deliberately the same three words a delivery roadmap uses, minus `pilot`, which no
 * AI capability is in.
 */
export type CapabilityStatus = 'live' | 'in-progress' | 'coming-soon'

/** Whether a product consumes this capability today. */
export type ConsumptionState = 'yes' | 'partial' | 'no'

export interface SolutionConsumption {
  /** Whether this product uses the capability today, not whether it should. */
  today: ConsumptionState
  /** What this product asks the capability for, in one sentence. */
  use: string
}

export interface AiCapability {
  /** Stable dotted id. Screens and tests reference this, never the name. */
  id: string
  /** URL segment under `/ai/`. Lowercase, hyphenated, stable — it gets bookmarked. */
  slug: string
  /** The menu label, exactly as it reads in the header. */
  name: string
  /** What the capability is for. One sentence, sentence case. */
  purpose: string
  /** Why it has to be one shared service instead of three implementations. */
  whyCentral: string
  /** What this product does about it today — the current source of truth. */
  todayHere: string
  /** What has to be built or moved before another product can call it. */
  toCentralise: readonly string[]
  /** What the platform gains once it is shared. */
  afterCentralisation: readonly string[]
  status: CapabilityStatus
  /**
   * HP BRAIN: the console sub-route of a capability that has a management screen of
   * its own, such as 'providers'. HP Brain has no URL router — the console resolves
   * this inside AiIntelligenceApp — so it is a route name, not an href.
   */
  route?: string
  /**
   * HP BRAIN: an existing HP Brain view that is this capability's working screen,
   * such as the Agent Monitor. Plays the part G2G's accessLink plays there.
   */
  openView?: string
  solutions: Record<SolutionId, SolutionConsumption>
}

/**
 * The twelve capabilities, in the order the menu lists them.
 *
 * Registry order is the running order — the menu and the console index both read it,
 * so re-ordering here re-orders every surface at once and nothing sorts at render
 * time behind anyone's back.
 */
export const AI_CAPABILITIES: readonly AiCapability[] = [
  {
    id: 'ai.providers',
    slug: 'providers',
    name: 'AI Providers',
    purpose:
      'The vendor accounts the platform is allowed to call, their credentials, endpoints and health.',
    whyCentral:
      'A key held in three codebases is rotated in three places and leaked from three places. One account, one rotation, one bill.',
    todayHere:
      "Live in HP Brain's own console. Each AI module can be bound to a provider, model and credential in hpbrain_ai_api_keys, and HP Brain's configuration resolver picks that binding per call, falling back to the provider set in HP Brain's own environment. Credentials are write-only: the screen shows a masked preview, never the key.",
    toCentralise: [
      'A provider record store: vendor, endpoint, credential reference, enabled modules. Done — ai_api_keys.',
      'A resolver that hands a caller a ready configuration and never the credential itself. Done — AiConfigurationResolver.',
      'A health and quota probe, so a dead key is visible before a user meets it as a broken answer.',
    ],
    afterCentralisation: [
      'Rotate a credential once and every module follows on its next call.',
      'A provider can be allowed for one organisation and withheld from another.',
      'No module ships a vendor key of its own.',
    ],
    status: 'live',
    route: 'providers',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Assessment, ESO, Recruitment and LMS content AI resolve provider, model and key from the central configuration.',
      },
      lms_k12: {
        today: 'yes',
        use: 'Runs the same resolution over its own credential table.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Resolves provider, model and key per module from its own configuration, never from another product's.",
      },
    },
  },

  {
    id: 'ai.models',
    slug: 'models',
    name: 'Model Management',
    purpose:
      'Which models exist, what each is approved for, and which one a given capability gets by default.',
    whyCentral:
      'Model management stays central and must never be re-implemented inside a module. Three model catalogues would mean a model retired in one product still serving traffic in another.',
    todayHere:
      "Live. hpbrain_ai_models is the one catalogue every model dropdown in HP Brain reads, seeded from HP Brain's own provider configuration. Platform rows are shared across organisations; an organisation may add its own.",
    toCentralise: [
      'A model catalogue keyed by provider, with cost and output ceiling. Done — ai_models.',
      'Default selection per module rather than per product. Done — the model column on a configuration row.',
      'A fallback chain, so a provider outage is absorbed without a code change.',
    ],
    afterCentralisation: [
      'Retire or swap a model once; every module picks up the change on its next request.',
      'Cost per capability becomes answerable, because the model behind it is known.',
    ],
    status: 'live',
    route: 'models',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Model choice is a catalogue row an administrator can read and change, not a constant in config or code.',
      },
      lms_k12: { today: 'yes', use: 'Same catalogue shape over its own rows.' },
      enterprise_brain: {
        today: 'yes',
        use: "Model choice is a catalogue row an administrator can read and change.",
      },
    },
  },

  {
    id: 'ai.prompts',
    // The slug stays `prompts` while the name reads "Template Management". It is the
    // identifier `/ai/prompts` is built from, and renaming the label costs nothing
    // while renaming the slug costs everyone's bookmarks.
    slug: 'prompts',
    name: 'Template Management',
    purpose:
      'Versioned AI templates for every module — Competency, Talent, LMS and the rest — written and managed in one place.',
    whyCentral:
      'A prompt copied into three codebases is three prompts the moment one is improved, and the improvement never reaches the other two. Per-module template screens would be the same mistake one level down.',
    todayHere:
      "Live. Templates are rows in hpbrain_ai_templates with a module, a version and a status. The module list comes from hpbrain_ai_modules, which describes HP Brain's own areas — signals, evidence, deliberation, decisions, capabilities and the rest — so the screen is the same for every module.",
    toCentralise: [
      'A template store with named variables, versions and an active pointer. Done — ai_templates.',
      'Render-time variable binding, so a caller supplies data and never prompt text. Done — substitution is literal and executes nothing.',
      'Moving the prompts still hard-coded in EsoGenerator, CourseQuizGenerator and the Gemini controllers into rows.',
    ],
    afterCentralisation: [
      'Improve a prompt once and every caller gets the better answer.',
      'A regression is rolled back by republishing the previous version instead of by a deploy.',
      'Prompts become reviewable content rather than string literals buried in services.',
    ],
    status: 'live',
    route: 'prompts',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Every module’s AI templates are authored, versioned and bound to their module from one screen.',
      },
      lms_k12: {
        today: 'yes',
        use: 'The same screen over its own modules, and additionally authors report layouts.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Authors and versions templates for signals, evidence, deliberation and its other modules from one screen.",
      },
    },
  },

  {
    id: 'ai.policies',
    slug: 'policies',
    name: 'AI Policies',
    purpose:
      'What the AI is permitted to do: data handling, redaction, tool limits, and when a human must approve.',
    whyCentral:
      'A policy that only one product enforces is not a policy. Every product touches the same people and the same records, so the rule has to sit where no caller can route around it.',
    todayHere:
      "Live. A policy is a type, a set of switches and the scopes it applies to — the whole organisation, a module, a department or a position — stored in hpbrain_ai_policies with its rules and assignments. Enforcement at every call site is the half still to come.",
    toCentralise: [
      'A policy document per organisation: retention, redaction, and the human-approval threshold. Done — ai_policies and its rules.',
      'Enforcement in the runtime, before a call is made, rather than in each caller.',
      'An overlay so a module can tighten a rule but never loosen it.',
    ],
    afterCentralisation: [
      'One place answers "what is this organisation allowed to send to a model".',
      'A tightened rule takes effect everywhere at once.',
      'Agent runs acquire an approval threshold that bounds them.',
    ],
    status: 'live',
    route: 'policies',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Policies are authored, scoped and resolvable; the call sites do not consult them yet.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Enforces shared security guards; module policy toggles are designed but locked.',
      },
      enterprise_brain: {
        today: 'partial',
        use: "Policies are authored and scoped; agent call sites do not consult them yet.",
      },
    },
  },

  {
    id: 'ai.agents',
    slug: 'agents',
    name: 'Agent Management',
    purpose: 'The library of agents, what each may do, and the record of what it did.',
    whyCentral:
      'The agent library is G2G’s to contribute. It becomes a shared service beside Enterprise Brain’s automation layer; existing agents move across carrying their module tag so nothing in flight breaks.',
    todayHere:
      "Live in HP Brain's Agent Monitor, which reports what the agents are doing and on whose authority. This console counts the same organisation's agent executions so they sit beside every other AI capability.",
    toCentralise: [
      'Offer the library to other products under each caller’s own permissions.',
      'One run history, filterable by product, so an agent’s behaviour is legible across all of them.',
      'Let a saved provider configuration override an agent’s own model, which it does not yet.',
    ],
    afterCentralisation: [
      'An agent is built once and offered to any product, under that product’s permissions.',
      'Agents in flight keep running through the migration.',
      'A misbehaving agent is disabled once, everywhere.',
    ],
    status: 'live',
    openView: 'agents',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Owns the library. Agents, runs and traces are G2G records.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Reads a library hosted elsewhere; becomes a first-class caller after the migration.',
      },
      enterprise_brain: {
        today: 'partial',
        use: "Hosts the automation layer and its Agent Monitor.",
      },
    },
  },

  {
    id: 'ai.conversational',
    slug: 'conversational-ai',
    name: 'Conversational AI',
    purpose:
      'One assistant runtime that knows which product and which module the question came from.',
    whyCentral:
      'Each product registering as an adapter is what keeps one assistant answering in three contexts. An unknown product id is an error rather than a silent fall back to another product’s data.',
    todayHere:
      "Live. The assistant is served by HP Brain's own /ai-intelligence/ask endpoint, resolves its provider through the central configuration, and grounds every answer in figures read live from this organisation's signals, evidence, decisions and structure. Transcripts are rows in hpbrain_ai_conversations and hpbrain_ai_conversation_turns, with the model and token cost recorded per turn.",
    toCentralise: [
      'Move the chat route behind the Laravel AI API so it resolves its provider like every other module. Done — /api/ai/ask.',
      'Give conversations durable storage. Done — they were an in-memory Map, lost on every restart.',
      'Retire the frontend chat route once the assistant panel points at the shared endpoint.',
      'Streaming. The panel waits for a complete answer today.',
    ],
    afterCentralisation: [
      'One assistant, three products, each answering in its own context and permissions.',
      'A new product is an adapter file and a registration, not a second assistant.',
    ],
    status: 'live',
    route: 'conversational-ai',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Serves its own grounded assistant over its own transcripts, on the central provider configuration.',
      },
      lms_k12: {
        today: 'yes',
        use: 'Hosts a runtime and the ask/stream proxy behind its own assistant panel.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Serves its own grounded assistant over its own transcripts.",
      },
    },
  },

  {
    id: 'ai.knowledge-rag',
    slug: 'knowledge-rag',
    name: 'Knowledge & RAG',
    purpose:
      'The documents each product can ground an answer in, and the retrieval that finds the right passage.',
    whyCentral:
      'Ingestion, chunking and embedding are expensive and identical everywhere. What differs is only which corpus an organisation may read — an access rule, not a reason for three pipelines.',
    todayHere:
      "Partly there. hpbrain_knowledge_assets holds this organisation's curated documents with categories, confidence and reuse counts, and hpbrain_evidence holds the observations behind them. Retrieval is not yet a contract any caller can use.",
    toCentralise: [
      'One ingestion pipeline: source, chunking, embedding, refresh schedule.',
      'Corpora scoped by organisation and by product, so retrieval cannot cross a boundary.',
      'A retrieval contract the runtime calls, so a caller asks a question and never runs a search.',
    ],
    afterCentralisation: [
      'A document is ingested once and grounds answers in whichever product may see it.',
      'Embedding cost is paid once per document rather than once per product.',
      'Answers cite a passage, which is what makes them checkable.',
    ],
    status: 'in-progress',
    openView: 'knowledgelibrary',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Holds knowledge assets and evidence; would ground answers in competency frameworks and role definitions.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would ground answers in circulars, policies and curriculum documents.',
      },
      enterprise_brain: {
        today: 'partial',
        use: "Holds knowledge assets and evidence; retrieval is not yet shared.",
      },
    },
  },

  {
    id: 'ai.recommendations',
    slug: 'recommendations',
    name: 'Recommendation Engine',
    purpose:
      'Turns stored evidence into ranked, explainable recommendations for any module that asks.',
    whyCentral:
      'A recommendation is only trusted if it can be explained, and the explanation is the evidence behind it. Three engines over three evidence stores would produce three different answers about the same person.',
    todayHere:
      "Live. The queue is this organisation's hpbrain_recommendations ordered by confidence, and opening one shows the reasoning step that produced it and the evidence behind it. Approve, reject and defer write the decision and an audit row; a recommendation already decided is refused rather than overwritten.",
    toCentralise: [
      'An approval gate with the explanation attached. Done — /ai/recommendations.',
      'A scoring contract any module can call: evidence in, ranked items out.',
      'Ranking that reads the shared knowledge graph rather than a per-product table.',
      'Per-module thresholds, so a promotion recommendation can require more confidence than a content suggestion does.',
    ],
    afterCentralisation: [
      'Any module asks the same question the same way and gets a comparable answer.',
      'Every recommendation carries its reasons, so it can be challenged.',
      'Improving the ranking improves it for every product at once.',
    ],
    status: 'live',
    route: 'recommendations',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Reviews and decides its own recommendations, each shown with the reasoning and evidence behind it.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would rank interventions and content for a concept.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Reviews and decides the recommendations its signals and deliberation loop produce.",
      },
    },
  },

  {
    id: 'ai.knowledge-graph',
    slug: 'knowledge-graph',
    name: 'Knowledge Graph',
    purpose: 'The shared evidence store every recommendation and explanation is drawn from.',
    whyCentral:
      'This is the substrate the other capabilities stand on. A person’s learning evidence, their capability record and their signals describe one person; kept apart they describe three.',
    todayHere:
      "Partly there. HP Brain's Graph Explorer draws this organisation's entities and relationships, and hpbrain_entity_mappings maps its source tables onto the universal entity model. A write contract other products can contribute through is still to come.",
    toCentralise: [
      'One entity and relationship model spanning person, capability, role, competency and evidence.',
      'Write contracts, so each product contributes facts without owning the schema.',
      'Tenant isolation in the store itself, not in the callers.',
    ],
    afterCentralisation: [
      'One record of what is known about a person, contributed to by every product.',
      'Recommendations and explanations read the same evidence, so they cannot contradict each other.',
      'A new product gains context on day one instead of starting empty.',
    ],
    status: 'in-progress',
    openView: 'graph',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Contributes the competency taxonomy and the entity mappings that the other products lack.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would contribute learning evidence and read capability context back.',
      },
      enterprise_brain: {
        today: 'partial',
        use: "Has the graph screens and is the natural host for the shared store.",
      },
    },
  },

  {
    id: 'ai.evaluation',
    slug: 'evaluation',
    name: 'AI Evaluation',
    purpose:
      'Test sets and scores that say whether a prompt or model change made answers better or worse.',
    whyCentral:
      'Once prompts and models are shared, a change ships to every product at once. Evaluation is what makes that safe — without it, centralising raises the blast radius without raising the confidence.',
    todayHere:
      "Live. An evaluation is a named set of cases against one published template; each case supplies the variables and declares what a correct answer must and must not contain. Running it calls the configured provider once per case at temperature 0 and scores by assertion. Stored in hpbrain_ai_eval_runs and hpbrain_ai_eval_cases.",
    toCentralise: [
      'Named test sets with expected outcomes. Done — ai_evaluations and its cases.',
      'Scoring that is reproducible. Done — assertions at temperature 0, not a model judging a model.',
      'Running a candidate prompt beside the active one and reporting the difference.',
      'A queue, so a run is not synchronous and bounded at 25 cases.',
      'A gate in the release path, so a regression is caught before it is promoted.',
    ],
    afterCentralisation: [
      'A prompt or model change is measured before it reaches an organisation.',
      'Each product contributes the cases it cares about and is protected by all of them.',
      'Regressions become a number rather than a support ticket.',
    ],
    status: 'live',
    route: 'evaluation',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Scores its own templates against its own cases before a prompt change reaches anyone.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would contribute curriculum, fees and admissions cases.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Scores its own templates against its own cases.",
      },
    },
  },

  {
    id: 'ai.usage-cost',
    slug: 'usage-cost',
    name: 'Usage & Cost',
    purpose: 'What each product, organisation and module spent on AI, and against which quota.',
    whyCentral:
      'The bill arrives as one number from the provider. Attributing it is only possible where the calls are counted, which is the same place the quota has to be enforced.',
    todayHere:
      "Live. Every call this console makes is metered into hpbrain_ai_usage_events with its module, provider, model, tokens, latency and outcome, broken down by module, model and day. Quotas in hpbrain_ai_usage_quotas are checked before a request is sent. Calls made by HP Brain's older AI pipeline are counted separately from hpbrain_ai_executions.",
    toCentralise: [
      'Metering at one point, tagged with organisation and module, so no caller can skip it. Done — AiUsageMeter.',
      'Quotas per organisation and per module, enforced before the call. Done.',
      'Cost per call. Done, but only where a rate exists — ai_models rates are null until somebody enters them, so the money column is honestly blank rather than estimated.',
      'Bringing the legacy callers (DeepSeekService, the Gemini controllers, the frontend chat route) through the same client, so their spend is counted too.',
      'Alerts, so passing a warning threshold reaches somebody who is not looking at this screen.',
    ],
    afterCentralisation: [
      'One provider bill is attributable to an organisation, a module and a model.',
      'A runaway agent hits a quota instead of an invoice.',
      'Cost per capability informs which model each capability should get.',
    ],
    status: 'live',
    route: 'usage-cost',
    solutions: {
      g2g: {
        today: 'yes',
        use: 'Meters every call this layer makes, attributes it by module and model, and enforces its own token quotas.',
      },
      lms_k12: {
        today: 'no',
        use: 'Would see spend per module and per school, and enforce a per-tenant quota.',
      },
      enterprise_brain: {
        today: 'yes',
        use: "Meters every console call and enforces its own token quotas.",
      },
    },
  },

  {
    id: 'ai.audit',
    slug: 'audit',
    name: 'AI Audit',
    purpose:
      'The record of every AI call: who asked, what was sent, which model answered, which tools ran.',
    whyCentral:
      'An audit trail split across products cannot answer the one question it exists for — what did the system do about this person. It also has to be written where a caller cannot skip it.',
    todayHere:
      "Live for configuration. Every change made through AI & Intelligence — a credential, a model, a template, a policy, a recommendation decision — is written to hpbrain_ai_audit_logs with its actor, outcome and a redacted payload. Model calls are traced in hpbrain_ai_usage_events and hpbrain_ai_executions.",
    toCentralise: [
      'One append-only record written by the runtime, not by callers.',
      'Redaction applied on write, so the trail does not become a second copy of the sensitive data. Done — AiAuditLogger redacts on write.',
      'Retention per the organisation’s policy, and a search that can be shown to an auditor.',
    ],
    afterCentralisation: [
      'One place answers what the AI did for a given person or organisation.',
      'The approval trail has somewhere to be written.',
      'Every product inherits auditability without implementing any of it.',
    ],
    status: 'live',
    solutions: {
      g2g: {
        today: 'partial',
        use: 'Every AI configuration change is traced; model calls are recorded elsewhere and not yet joined to it.',
      },
      lms_k12: {
        today: 'partial',
        use: 'Conversational calls are traced; nothing else is.',
      },
      enterprise_brain: {
        today: 'partial',
        use: "Configuration changes and decisions are traced; older pipeline calls are recorded separately.",
      },
    },
  },
]
