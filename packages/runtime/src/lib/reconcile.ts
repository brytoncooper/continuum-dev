import type { SchemaSnapshot, StateSnapshot } from '@continuum/contract';
import type { ReconciliationOptions, ReconciliationResult } from './types.js';
import { buildReconciliationContext, buildPriorValueMap } from './context.js';
import { buildFreshSessionResult, buildBlindCarryResult, assembleReconciliationResult } from './reconciliation/state-builder.js';
import { resolveAllComponents, detectRemovedComponents } from './reconciliation/component-resolver.js';

export function reconcile(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot | null,
  priorState: StateSnapshot | null,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const now = (options.clock ?? Date.now)();

  if (!priorState) {
    return buildFreshSessionResult(newSchema, now);
  }

  if (!priorSchema) {
    return buildBlindCarryResult(newSchema, priorState, now, options);
  }

  return reconcileSchemaTransition(newSchema, priorSchema, priorState, now, options);
}

function reconcileSchemaTransition(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot,
  priorState: StateSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const ctx = buildReconciliationContext(newSchema, priorSchema);
  const priorValues = buildPriorValueMap(priorState, ctx);
  const resolved = resolveAllComponents(ctx, priorValues, priorState, now, options);
  const removals = detectRemovedComponents(ctx, priorState, options);
  return assembleReconciliationResult(resolved, removals, priorState, newSchema, now);
}
