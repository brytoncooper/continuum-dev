import type { ComponentDefinition, ComponentState, OrphanedValue, StateSnapshot } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type {
  ComponentResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  StateDiff,
} from '../types.js';
import type { ReconciliationContext } from '../context.js';
import {
  findPriorComponent,
  determineComponentMatchStrategy,
} from '../context.js';
import {
  addedDiff,
  addedTrace,
  typeChangedDiff,
  droppedTrace,
  migratedDiff,
  migratedTrace,
  carriedTrace,
  removedDiff,
  restoredDiff,
  restoredTrace,
} from './differ.js';
import { attemptMigration } from './migrator.js';
import { carryValuesMeta } from './state-builder.js';
import { validateComponentState } from './validator.js';

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
    orphanedValues: {},
    restoredOrphanKeys: new Set<string>(),
    diffs: [],
    trace: [],
    issues: [],
  };

  for (const [newId, newComponent] of ctx.newById) {
    const priorComponent = findPriorComponent(ctx, newComponent);
    const priorValue =
      priorValues.get(newId) ?? (priorComponent ? priorState.values[priorComponent.id] : undefined);
    const matchedBy = determineComponentMatchStrategy(ctx, newComponent, priorComponent);

    if (!priorComponent) {
      resolveNewComponent(acc, newId, newComponent, priorState, now);
    } else if (priorComponent.type !== newComponent.type) {
      resolveTypeMismatchedComponent(acc, newId, priorComponent, newComponent, matchedBy, priorValue, ctx, now);
    } else if (hasComponentHashChanged(priorComponent, newComponent)) {
      resolveHashChangedComponent(acc, newId, priorComponent, newComponent, matchedBy, priorValue, priorState, now, options);
    } else {
      resolveUnchangedComponent(acc, newId, priorComponent, matchedBy as 'id' | 'key', priorValue, priorState, now);
    }

    acc.issues.push(
      ...validateComponentState(
        newComponent,
        acc.values[newId] as ComponentState | undefined
      )
    );
  }

  return acc;
}

function resolveNewComponent(
  acc: ComponentResolutionAccumulator,
  newId: string,
  newComponent: ComponentDefinition,
  priorState: StateSnapshot,
  now: number
): void {
  const orphanKey = newComponent.key ?? newId;
  const orphan = priorState.orphanedValues?.[orphanKey];
  if (orphan && orphan.componentType === newComponent.type) {
    acc.values[newId] = orphan.value as ComponentState;
    acc.restoredOrphanKeys.add(orphanKey);
    acc.diffs.push(restoredDiff(newId, orphan.value));
    acc.trace.push(restoredTrace(newId, newComponent.type, orphan.value));
    return;
  }
  if (newComponent.defaultValue !== undefined) {
    acc.values[newId] = newComponent.defaultValue as ComponentState;
  }
  acc.diffs.push(addedDiff(newId));
  acc.trace.push(addedTrace(newId, newComponent.type));
}

function resolveTypeMismatchedComponent(
  acc: ComponentResolutionAccumulator,
  newId: string,
  priorComponent: ComponentDefinition,
  newComponent: ComponentDefinition,
  matchedBy: 'id' | 'key' | null,
  priorValue: unknown,
  ctx: ReconciliationContext,
  now: number
): void {
  acc.issues.push({
    severity: ISSUE_SEVERITY.ERROR,
    componentId: newId,
    message: `Component type mismatch: ${priorComponent.type} -> ${newComponent.type}`,
    code: ISSUE_CODES.TYPE_MISMATCH,
  });
  acc.diffs.push(typeChangedDiff(newId, priorValue, priorComponent.type, newComponent.type));
  acc.trace.push(droppedTrace(newId, priorComponent.id, matchedBy, priorComponent.type, newComponent.type, priorValue));
  if (priorValue !== undefined) {
    const orphanKey = priorComponent.key ?? priorComponent.id;
    acc.orphanedValues[orphanKey] = {
      value: priorValue as ComponentState,
      componentType: priorComponent.type,
      key: priorComponent.key,
      orphanedAt: now,
      schemaVersion: ctx.priorSchema?.version ?? 'unknown',
      reason: 'type-mismatch',
    };
  }
}

function hasComponentHashChanged(
  priorComponent: ComponentDefinition,
  newComponent: ComponentDefinition
): boolean {
  return !!(priorComponent.hash && newComponent.hash && priorComponent.hash !== newComponent.hash);
}

function resolveHashChangedComponent(
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
  const migrationResult = attemptMigration(newId, priorComponent, newComponent, priorValue, options);

  if (migrationResult.kind === 'migrated') {
    acc.values[newId] = migrationResult.value as ComponentState;
    carryValuesMeta(acc.valuesMeta, newId, priorComponent.id, priorState, now, true);
    acc.diffs.push(migratedDiff(newId, priorValue, migrationResult.value));
    acc.trace.push(
      migratedTrace(
        newId,
        priorComponent.id,
        matchedBy,
        priorComponent.type,
        newComponent.type,
        priorValue,
        migrationResult.value
      )
    );
    return;
  }

  const message = migrationResult.kind === 'error'
    ? `Component ${newId} migration failed: ${String(migrationResult.error)}`
    : `Component ${newId} schema changed but no migration strategy available`;

  acc.issues.push({
    severity: ISSUE_SEVERITY.WARNING,
    componentId: newId,
    message,
    code: ISSUE_CODES.MIGRATION_FAILED,
  });

  resolveUnchangedComponent(acc, newId, priorComponent, matchedBy as 'id' | 'key', priorValue, priorState, now);
}

function resolveUnchangedComponent(
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
  options: ReconciliationOptions,
  now: number
): { diffs: StateDiff[]; issues: ReconciliationIssue[]; orphanedValues: Record<string, OrphanedValue> } {
  const diffs: StateDiff[] = [];
  const issues: ReconciliationIssue[] = [];
  const orphanedValues: Record<string, OrphanedValue> = {};

  for (const [priorId, priorValue] of Object.entries(priorState.values)) {
    const priorComp = ctx.priorById.get(priorId);
    const stillExists =
      ctx.newById.has(priorId) ||
      (priorComp?.key ? ctx.newByKey.has(priorComp.key) : false);

    if (!stillExists) {
      diffs.push(removedDiff(priorId, priorValue));
      if (priorValue !== undefined) {
        const orphanKey = priorComp?.key ?? priorId;
        orphanedValues[orphanKey] = {
          value: priorValue as ComponentState,
          componentType: priorComp?.type ?? 'unknown',
          key: priorComp?.key,
          orphanedAt: now,
          schemaVersion: ctx.priorSchema?.version ?? 'unknown',
          reason: 'removed',
        };
      }
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

  return { diffs, issues, orphanedValues };
}
