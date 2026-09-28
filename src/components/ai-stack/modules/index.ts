import type { AiStackModule } from '../ai-stack-module';
import { agentsAiStack } from './agents';
import { capabilitiesAiStack } from './capabilities';
import { decisionAnalyticsAiStack } from './decision_analytics';
import { deliberationAiStack } from './deliberation';
import { departmentsAiStack } from './departments';
import { esoAiStack } from './eso';
import { evidenceAiStack } from './evidence';
import { executionsAiStack } from './executions';
import { intelligenceWorkspaceAiStack } from './intelligence_workspace';
import { kasbaAiStack } from './kasba';
import { knowledgeGraphAiStack } from './knowledge_graph';
import { knowledgeLibraryAiStack } from './knowledge_library';
import { mentalModelsAiStack } from './mental_models';
import { organisationalMemoryAiStack } from './organisational_memory';
import { peopleAiStack } from './people';
import { policiesAiStack } from './policies';
import { signalsAiStack } from './signals';
import { tasksAiStack } from './tasks';

/**
 * Every HP Brain module that has an AI Stack, keyed by its `hpbrain_ai_modules.module_key`.
 *
 * The keys are the same ones `moduleViews.ts` maps each screen to; a key there with no
 * descriptor here is surfaced by `ModuleAiStackPanel` as an error rather than an empty tab.
 */
export const AI_STACK_MODULES: Record<string, AiStackModule> = {
  [departmentsAiStack.key]: departmentsAiStack,
  [peopleAiStack.key]: peopleAiStack,
  [capabilitiesAiStack.key]: capabilitiesAiStack,
  [signalsAiStack.key]: signalsAiStack,
  [evidenceAiStack.key]: evidenceAiStack,
  [deliberationAiStack.key]: deliberationAiStack,
  [intelligenceWorkspaceAiStack.key]: intelligenceWorkspaceAiStack,
  [executionsAiStack.key]: executionsAiStack,
  [decisionAnalyticsAiStack.key]: decisionAnalyticsAiStack,
  [mentalModelsAiStack.key]: mentalModelsAiStack,
  [knowledgeGraphAiStack.key]: knowledgeGraphAiStack,
  [kasbaAiStack.key]: kasbaAiStack,
  [knowledgeLibraryAiStack.key]: knowledgeLibraryAiStack,
  [organisationalMemoryAiStack.key]: organisationalMemoryAiStack,
  [esoAiStack.key]: esoAiStack,
  [agentsAiStack.key]: agentsAiStack,
  [tasksAiStack.key]: tasksAiStack,
  [policiesAiStack.key]: policiesAiStack,
};
