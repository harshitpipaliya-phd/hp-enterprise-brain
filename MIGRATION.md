# TASK 16 -- point ESOCard at the real contract

The current `ESOCard.d.ts` defines its own `ESOModel`. That shape reflects the
**nine-field error**. The real contract has **twelve blocks**.

## Do this

```ts
// web/components/intelligence/ESOCard.d.ts
import type { ESOContract } from '@hpbrain/contracts';

export interface ESOCardProps {
  eso: ESOContract;
  onDecision?: (type: 'approve'|'reject'|'modify'|'delegate'|'schedule'|'ignore') => void;
}
```

Then **delete the local `ESOModel`**.

## Two real UI changes fall out of this

1. **Executor is per-step, not per-ESO.** The card must render an executor class
   for each step in `procedure.steps[]` -- `human | agent | software | hybrid`.
   Most real work is hybrid at step granularity (section 5.2).
2. **Autonomy is a trust ladder** -- `observe | suggest | approve | autonomous`,
   held per executor in `executorPolicy.trustLevels[]`.

## Rule

The design system CONSUMES the contract. It never defines it.
That inversion is how "nine fields" survived for weeks.
