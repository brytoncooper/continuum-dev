import type {
  ComponentDefinition,
  ComponentState,
  SchemaSnapshot,
  StateSnapshot,
  ValueMeta,
} from '@continuum/contract';
import {
  ISSUE_CODES,
  ISSUE_SEVERITY,
} from '@continuum/contract';
import type {
  ComponentResolutionAccumulator,
  ReconciliationIssue,
  ReconciliationOptions,
  ReconciliationResult,
  StateDiff,
  ReconciliationTrace,
} from '../types.js';
import { addedDiff, addedTrace } from './differ.js';

export function buildFreshSessionResult(
  newSchema: SchemaSnapshot,
  now: number
): ReconciliationResult {
  const diffs: StateDiff[] = [];
  const trace: ReconciliationTrace[] = [];

  collectComponentsAsFreshlyAdded(newSchema.components, diffs, trace);

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
    diffs,
    issues: [
      {
        severity: ISSUE_SEVERITY.INFO,
        message: 'No prior state found, starting fresh',
        code: ISSUE_CODES.NO_PRIOR_STATE,
      },
    ],
    trace,
  };
}

function collectComponentsAsFreshlyAdded(
  components: ComponentDefinition[],
  diffs: StateDiff[],
  trace: ReconciliationTrace[]
): void {
  for (const comp of components) {
    diffs.push(addedDiff(comp.id));
    trace.push(addedTrace(comp.id, comp.type));
    if (comp.children) collectComponentsAsFreshlyAdded(comp.children, diffs, trace);
  }
}

function collectComponentIds(components: ComponentDefinition[]): Set<string> {
  const ids = new Set<string>();

  function walk(nodes: ComponentDefinition[]): void {
    for (const node of nodes) {
      ids.add(node.id);
      if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(components);
  return ids;
}

export function buildBlindCarryResult(
  newSchema: SchemaSnapshot,
  priorState: StateSnapshot,
  now: number,
  options: ReconciliationOptions
): ReconciliationResult {
  const issues: ReconciliationIssue[] = [
    {
      severity: ISSUE_SEVERITY.WARNING,
      message: 'Prior state exists but no prior schema provided; cannot reconcile',
      code: ISSUE_CODES.NO_PRIOR_SCHEMA,
    },
  ];

  if (options.allowBlindCarry) {
    const newIds = collectComponentIds(newSchema.components);
    const carriedValues: Record<string, ComponentState> = {};
    for (const [id, value] of Object.entries(priorState.values)) {
      if (newIds.has(id)) {
        carriedValues[id] = value;
        issues.push({
          severity: ISSUE_SEVERITY.INFO,
          componentId: id,
          message: `Component ${id} state carried without schema validation`,
          code: ISSUE_CODES.UNTRUSTED_CARRY,
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
      issues,
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
    issues,
    trace: [],
  };
}

export function assembleReconciliationResult(
  resolved: ComponentResolutionAccumulator,
  removals: { diffs: StateDiff[]; issues: ReconciliationIssue[] },
  priorState: StateSnapshot,
  newSchema: SchemaSnapshot,
  now: number
): ReconciliationResult {
  const schemaHash = computeSchemaHash(newSchema);
  const hasValuesMeta = Object.keys(resolved.valuesMeta).length > 0;

  return {
    reconciledState: {
      values: resolved.values,
      meta: {
        ...priorState.meta,
        timestamp: now,
        schemaId: newSchema.schemaId,
        schemaVersion: newSchema.version,
        ...(schemaHash !== undefined ? { schemaHash } : {}),
      },
      ...(hasValuesMeta ? { valuesMeta: resolved.valuesMeta } : {}),
    },
    diffs: [...resolved.diffs, ...removals.diffs],
    issues: [...resolved.issues, ...removals.issues],
    trace: resolved.trace,
  };
}

export function carryValuesMeta(
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

export function computeSchemaHash(schema: SchemaSnapshot): string | undefined {
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

export function generateSessionId(now: number): string {
  return `session_${now}_${Math.random().toString(36).substring(2, 9)}`;
}
