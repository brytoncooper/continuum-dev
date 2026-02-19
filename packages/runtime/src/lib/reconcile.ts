import type {
  ComponentDefinition,
  ComponentState,
  SchemaSnapshot,
  StateSnapshot,
  ValueMeta,
} from '@continuum/contract';
import type {
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResult,
  ReconciliationTrace,
  StateDiff,
} from './types.js';
import type { ReconciliationContext } from './context.js';
import {
  buildReconciliationContext,
  findPriorComponent,
} from './context.js';

export function reconcile(
  newSchema: SchemaSnapshot,
  priorSchema: SchemaSnapshot | null,
  priorState: StateSnapshot | null,
  options: ReconciliationOptions = {}
): ReconciliationResult {
  const now = (options.clock ?? Date.now)();
  const diffs: StateDiff[] = [];
  const issues: ReconciliationIssue[] = [];
  const trace: ReconciliationTrace[] = [];
  const reconciledValues: Record<string, ComponentState> = {};
  const reconciledValuesMeta: Record<string, ValueMeta> = {};
  const ctx = buildReconciliationContext(newSchema, priorSchema);

  if (!priorState) {
    return {
      reconciledState: {
        values: {},
        meta: {
          timestamp: now,
          sessionId: generateSessionId(now),
          schemaId: newSchema.schemaId,
          schemaVersion: newSchema.version,
        },
      },
      diffs: [],
      issues: [
        {
          severity: 'info',
          message: 'No prior state found, starting fresh',
          code: 'NO_PRIOR_STATE',
        },
      ],
      trace: [],
    };
  }

  if (!priorSchema) {
    const blindIssues: ReconciliationIssue[] = [
      {
        severity: 'warning',
        message: 'Prior state exists but no prior schema provided; cannot reconcile',
        code: 'NO_PRIOR_SCHEMA',
      },
    ];

    if (options.allowBlindCarry) {
      const newIds = new Set(newSchema.components.map((c) => c.id));
      const carriedValues: Record<string, ComponentState> = {};
      for (const [id, value] of Object.entries(priorState.values)) {
        if (newIds.has(id)) {
          carriedValues[id] = value;
          blindIssues.push({
            severity: 'info',
            componentId: id,
            message: `Component ${id} state carried without schema validation`,
            code: 'UNTRUSTED_CARRY',
          });
        }
      }

      return {
        reconciledState: {
          values: carriedValues,
          meta: {
            ...priorState.meta,
            timestamp: now,
            schemaId: newSchema.schemaId,
            schemaVersion: newSchema.version,
          },
        },
        diffs: [],
        issues: blindIssues,
        trace: [],
      };
    }

    return {
      reconciledState: {
        values: {},
        meta: {
          ...priorState.meta,
          timestamp: now,
          schemaId: newSchema.schemaId,
          schemaVersion: newSchema.version,
        },
      },
      diffs: [],
      issues: blindIssues,
      trace: [],
    };
  }

  const priorValueByNewId = buildPriorValueMap(priorState, ctx);

  for (const [newId, newComponent] of ctx.newById) {
    const priorComponent = findPriorComponent(ctx, newComponent);
    const priorValue =
      priorValueByNewId.get(newId) ?? (priorComponent ? priorState.values[priorComponent.id] : undefined);

    const matchedBy: 'id' | 'key' | null = priorComponent
      ? ctx.priorById.has(newComponent.id) ? 'id' : 'key'
      : null;

    if (!priorComponent) {
      diffs.push({
        componentId: newId,
        type: 'added',
        newValue: undefined,
        reason: 'Component added to schema',
      });
      trace.push({
        componentId: newId,
        priorId: null,
        matchedBy: null,
        priorType: null,
        newType: newComponent.type,
        action: 'added',
        priorValue: undefined,
        reconciledValue: undefined,
      });
      continue;
    }

    if (priorComponent.type !== newComponent.type) {
      issues.push({
        severity: 'error',
        componentId: newId,
        message: `Component type mismatch: ${priorComponent.type} -> ${newComponent.type}`,
        code: 'TYPE_MISMATCH',
      });
      diffs.push({
        componentId: newId,
        type: 'type-changed',
        oldValue: priorValue,
        reason: `Type changed from ${priorComponent.type} to ${newComponent.type}`,
      });
      trace.push({
        componentId: newId,
        priorId: priorComponent.id,
        matchedBy,
        priorType: priorComponent.type,
        newType: newComponent.type,
        action: 'dropped',
        priorValue,
        reconciledValue: undefined,
      });
      continue;
    }

    const hasHashChange =
      priorComponent.hash && newComponent.hash && priorComponent.hash !== newComponent.hash;

    if (hasHashChange) {
      const migratedValue = attemptMigration(
        newId,
        priorComponent,
        newComponent,
        priorValue,
        options
      );
      if (migratedValue !== null) {
        reconciledValues[newId] = migratedValue as ComponentState;
        carryValuesMeta(reconciledValuesMeta, newId, priorComponent.id, priorState, now, true);
        diffs.push({
          componentId: newId,
          type: 'migrated',
          oldValue: priorValue,
          newValue: migratedValue,
          reason: 'Component schema changed, migration applied',
        });
        trace.push({
          componentId: newId,
          priorId: priorComponent.id,
          matchedBy,
          priorType: priorComponent.type,
          newType: newComponent.type,
          action: 'migrated',
          priorValue,
          reconciledValue: migratedValue,
        });
        continue;
      }
      issues.push({
        severity: 'warning',
        componentId: newId,
        message: `Component ${newId} schema changed but no migration strategy available`,
        code: 'MIGRATION_FAILED',
      });
    }

    if (priorValue !== undefined) {
      reconciledValues[newId] = priorValue as ComponentState;
      carryValuesMeta(reconciledValuesMeta, newId, priorComponent.id, priorState, now, false);
      trace.push({
        componentId: newId,
        priorId: priorComponent.id,
        matchedBy,
        priorType: priorComponent.type,
        newType: newComponent.type,
        action: 'carried',
        priorValue,
        reconciledValue: priorValue,
      });
    } else {
      trace.push({
        componentId: newId,
        priorId: priorComponent.id,
        matchedBy,
        priorType: priorComponent.type,
        newType: newComponent.type,
        action: 'carried',
        priorValue: undefined,
        reconciledValue: undefined,
      });
    }
  }

  for (const [priorId, priorValue] of Object.entries(priorState.values)) {
    const priorComp = ctx.priorById.get(priorId);
    const stillExists =
      ctx.newById.has(priorId) ||
      (priorComp?.key ? ctx.newByKey.has(priorComp.key) : false);
    if (!stillExists) {
      diffs.push({
        componentId: priorId,
        type: 'removed',
        oldValue: priorValue,
        reason: 'Component removed from schema',
      });
      if (!options.allowPartialRestore) {
        issues.push({
          severity: 'warning',
          componentId: priorId,
          message: `Component ${priorId} was removed from schema`,
          code: 'COMPONENT_REMOVED',
        });
      }
    }
  }

  const schemaHash = computeSchemaHash(newSchema);
  const hasValuesMeta = Object.keys(reconciledValuesMeta).length > 0;

  return {
    reconciledState: {
      values: reconciledValues,
      meta: {
        ...priorState.meta,
        timestamp: now,
        schemaId: newSchema.schemaId,
        schemaVersion: newSchema.version,
        ...(schemaHash !== undefined ? { schemaHash } : {}),
      },
      ...(hasValuesMeta ? { valuesMeta: reconciledValuesMeta } : {}),
    },
    diffs,
    issues,
    trace,
  };
}

function buildPriorValueMap(
  priorState: StateSnapshot,
  ctx: ReconciliationContext
): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [priorId, priorValue] of Object.entries(priorState.values)) {
    map.set(priorId, priorValue);
    const priorComp = ctx.priorById.get(priorId);
    if (priorComp?.key) {
      const newComp = ctx.newByKey.get(priorComp.key);
      if (newComp) map.set(newComp.id, priorValue);
    }
  }
  return map;
}

function attemptMigration(
  componentId: string,
  oldSchema: ComponentDefinition,
  newSchema: ComponentDefinition,
  oldState: unknown,
  options: ReconciliationOptions
): unknown | null {
  if (options.migrationStrategies?.[componentId]) {
    return options.migrationStrategies[componentId](
      componentId,
      oldSchema,
      newSchema,
      oldState
    );
  }

  if (newSchema.migrations && oldSchema.hash && newSchema.hash && options.strategyRegistry) {
    const rule = newSchema.migrations.find(
      (m) => m.fromHash === oldSchema.hash && m.toHash === newSchema.hash
    );
    if (rule?.strategyId && options.strategyRegistry[rule.strategyId]) {
      return options.strategyRegistry[rule.strategyId](
        componentId,
        oldSchema,
        newSchema,
        oldState
      );
    }
  }

  if (oldSchema.type === newSchema.type) {
    return oldState;
  }
  return null;
}

function carryValuesMeta(
  target: Record<string, ValueMeta>,
  newId: string,
  priorId: string,
  priorState: StateSnapshot,
  now: number,
  isMigrated: boolean
): void {
  const priorMeta = priorState.valuesMeta?.[priorId];
  if (priorMeta) {
    target[newId] = isMigrated
      ? { ...priorMeta, lastUpdated: now }
      : { ...priorMeta };
  }
}

function computeSchemaHash(schema: SchemaSnapshot): string | undefined {
  const hashes: string[] = [];
  function collect(components: ComponentDefinition[]) {
    for (const comp of components) {
      if (comp.hash) hashes.push(comp.hash);
      if (comp.children) collect(comp.children);
    }
  }
  collect(schema.components);
  if (hashes.length === 0) return undefined;
  return hashes.sort().join(':');
}

function generateSessionId(now: number): string {
  return `session_${now}_${Math.random().toString(36).substring(2, 9)}`;
}
