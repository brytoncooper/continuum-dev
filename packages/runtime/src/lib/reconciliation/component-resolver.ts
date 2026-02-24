import type { ComponentDefinition, ComponentState, StateSnapshot } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type {
  ComponentResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  StateDiff,
} from '../types.js';
import type { ReconciliationContext } from '../context.js';
import { findPriorComponent, determineMatchType } from '../context.js';
import {
  addedDiff,
  addedTrace,
  typeChangedDiff,
  droppedTrace,
  migratedDiff,
  migratedTrace,
  carriedTrace,
  removedDiff,
} from './differ.js';
import { attemptMigration } from './migrator.js';
import { carryValuesMeta } from './state-builder.js';

export function resolveAllComponents(
  ctx: ReconciliationContext,
  priorValues: Map<string, unknown>,
  priorState: StateSnapshot,
  now: number,
  options: ReconciliationOptions
): ComponentResolutionAccumulator {
  const acc: ComponentResolutionAccumulator = {
    values: {},
    valuesMeta: {},
    diffs: [],
    trace: [],
    issues: [],
  };

  for (const [newId, newComponent] of ctx.newById) {
    const priorComponent = findPriorComponent(ctx, newComponent);
    const priorValue =
      priorValues.get(newId) ?? (priorComponent ? priorState.values[priorComponent.id] : undefined);
    const matchedBy = determineMatchType(ctx, newComponent, priorComponent);

    if (!priorComponent) {
      recordAddedComponent(acc, newId, newComponent.type);
    } else if (priorComponent.type !== newComponent.type) {
      recordTypeChanged(acc, newId, priorComponent, newComponent, matchedBy, priorValue);
    } else if (hasSchemaHashChange(priorComponent, newComponent)) {
      recordMigratedOrCarried(acc, newId, priorComponent, newComponent, matchedBy, priorValue, priorState, now, options);
    } else {
      recordCarriedComponent(acc, newId, priorComponent, matchedBy as 'id' | 'key', priorValue, priorState, now);
    }
  }

  return acc;
}

function recordAddedComponent(
  acc: ComponentResolutionAccumulator,
  newId: string,
  newType: string
): void {
  acc.diffs.push(addedDiff(newId));
  acc.trace.push(addedTrace(newId, newType));
}

function recordTypeChanged(
  acc: ComponentResolutionAccumulator,
  newId: string,
  priorComponent: ComponentDefinition,
  newComponent: ComponentDefinition,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown
): void {
  acc.issues.push({
    severity: ISSUE_SEVERITY.ERROR,
    componentId: newId,
    message: `Component type mismatch: ${priorComponent.type} -> ${newComponent.type}`,
    code: ISSUE_CODES.TYPE_MISMATCH,
  });
  acc.diffs.push(typeChangedDiff(newId, priorValue, priorComponent.type, newComponent.type));
  acc.trace.push(droppedTrace(newId, priorComponent.id, matchedBy, priorComponent.type, newComponent.type, priorValue));
}

function hasSchemaHashChange(
  priorComponent: ComponentDefinition,
  newComponent: ComponentDefinition
): boolean {
  return !!(priorComponent.hash && newComponent.hash && priorComponent.hash !== newComponent.hash);
}

function recordMigratedOrCarried(
  acc: ComponentResolutionAccumulator,
  newId: string,
  priorComponent: ComponentDefinition,
  newComponent: ComponentDefinition,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown,
  priorState: StateSnapshot,
  now: number,
  options: ReconciliationOptions
): void {
  const migratedValue = attemptMigration(newId, priorComponent, newComponent, priorValue, options);

  if (migratedValue !== null) {
    acc.values[newId] = migratedValue as ComponentState;
    carryValuesMeta(acc.valuesMeta, newId, priorComponent.id, priorState, now, true);
    acc.diffs.push(migratedDiff(newId, priorValue, migratedValue));
    acc.trace.push(migratedTrace(newId, priorComponent.id, matchedBy, priorComponent.type, newComponent.type, priorValue, migratedValue));
    return;
  }

  acc.issues.push({
    severity: ISSUE_SEVERITY.WARNING,
    componentId: newId,
    message: `Component ${newId} schema changed but no migration strategy available`,
    code: ISSUE_CODES.MIGRATION_FAILED,
  });

  recordCarriedComponent(acc, newId, priorComponent, matchedBy as 'id' | 'key', priorValue, priorState, now);
}

function recordCarriedComponent(
  acc: ComponentResolutionAccumulator,
  newId: string,
  priorComponent: ComponentDefinition,
  matchedBy: 'id' | 'key',
  priorValue: unknown,
  priorState: StateSnapshot,
  now: number
): void {
  if (priorValue !== undefined) {
    acc.values[newId] = priorValue as ComponentState;
    carryValuesMeta(acc.valuesMeta, newId, priorComponent.id, priorState, now, false);
  }

  acc.trace.push(carriedTrace(
    newId,
    priorComponent.id,
    matchedBy,
    priorComponent.type,
    priorValue,
    priorValue !== undefined ? priorValue : undefined
  ));
}

export function detectRemovedComponents(
  ctx: ReconciliationContext,
  priorState: StateSnapshot,
  options: ReconciliationOptions
): { diffs: StateDiff[]; issues: ReconciliationIssue[] } {
  const diffs: StateDiff[] = [];
  const issues: ReconciliationIssue[] = [];

  for (const [priorId, priorValue] of Object.entries(priorState.values)) {
    const priorComp = ctx.priorById.get(priorId);
    const stillExists =
      ctx.newById.has(priorId) ||
      (priorComp?.key ? ctx.newByKey.has(priorComp.key) : false);

    if (!stillExists) {
      diffs.push(removedDiff(priorId, priorValue));
      if (!options.allowPartialRestore) {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          componentId: priorId,
          message: `Component ${priorId} was removed from schema`,
          code: ISSUE_CODES.COMPONENT_REMOVED,
        });
      }
    }
  }

  return { diffs, issues };
}
