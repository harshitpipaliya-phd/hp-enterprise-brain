/**
 * The chrome every AI Stack screen shares, under the names the shared screens import.
 *
 * In LMS_K12 and G2G this file is a seam over the Fees AI chrome. HP Brain has no Fees
 * module, so the implementation lives beside it (ai-stack-chrome-impl.tsx) and this
 * keeps the same exported names, which is what lets the ported tab screens read the
 * same as their G2G originals.
 */

export {
  FeesAiCard as AiStackCard,
  FeesAiCardHeading as AiStackCardHeading,
  FeesAiEmpty as AiStackEmpty,
  FeesAiError as AiStackError,
  FeesAiHeader as AiStackHeader,
  FeesAiHint as AiStackHint,
  FeesAiLoading as AiStackLoading,
  FeesAiMetrics as AiStackMetrics,
  FeesAiNotice as AiStackNotice,
  FeesAiPill as AiStackPill,
  FeesAiTableHead as AiStackTableHead,
  formatWhen,
} from './ai-stack-chrome-impl';
