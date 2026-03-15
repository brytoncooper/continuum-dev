import { describe, it, expect } from 'vitest';
import type {
  ViewNode,
  ViewDefinition,
  DataSnapshot,
  NodeValue,
} from '@continuum-dev/contract';
import {
  buildFreshSessionResult,
  buildBlindCarryResult,
  assembleReconciliationResult,
  carryValuesMeta,
  computeViewHash,
  generateSessionId,
} from './index.js';

function makeView(
  nodes: ViewNode[],
  viewId = 'view-1',
  version = '1.0'
): ViewDefinition {
  return { viewId, version, nodes };
}

function makeNode(
  overrides: Partial<ViewNode> & { id: string; type?: ViewNode['type'] }
): ViewNode {
  const type = overrides.type ?? 'field';
  return {
    id: overrides.id,
    key: overrides.key,
    hash: overrides.hash,
    hidden: overrides.hidden,
    migrations: overrides.migrations,
    type,
    ...(type === 'field' ? { dataType: 'string' } : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...overrides,
  } as ViewNode;
}

function makeData(
  values: Record<string, NodeValue>,
  lineage?: Partial<DataSnapshot['lineage']>,
  valueLineage?: DataSnapshot['valueLineage']
): DataSnapshot {
  return {
    values,
    lineage: { timestamp: 1000, sessionId: 'test-session', ...lineage },
    valueLineage,
  };
}

describe('buildFreshSessionResult', () => {
  it('returns empty values with a new session id', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const result = buildFreshSessionResult({ newView: view, now: 5000 });

    expect(result.reconciledState.values).toEqual({});
    expect(result.reconciledState.lineage.sessionId).toContain('session_');
    expect(result.reconciledState.lineage.timestamp).toBe(5000);
  });

  it('generates added diffs for all nodes including children', () => {
    const view = makeView([
      makeNode({
        id: 'parent',
        type: 'group',
        children: [makeNode({ id: 'child' })],
      }),
    ]);
    const result = buildFreshSessionResult({ newView: view, now: 5000 });

    expect(result.diffs).toHaveLength(2);
    expect(result.diffs[0].nodeId).toBe('parent');
    expect(result.diffs[1].nodeId).toBe('parent/child');
  });

  it('emits NO_PRIOR_DATA info issue', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const result = buildFreshSessionResult({ newView: view, now: 5000 });

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('NO_PRIOR_DATA');
  });
});

describe('buildBlindCarryResult', () => {
  it('drops all values when allowBlindCarry is false', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData({ a: { value: 'hello' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {},
    });

    expect(result.reconciledState.values).toEqual({});
    expect(result.issues[0].code).toBe('NO_PRIOR_VIEW');
  });

  it('carries matching values when allowBlindCarry is true', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData({ a: { value: 'hello' }, orphan: { value: 'gone' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    expect(result.reconciledState.values['orphan']).toBeUndefined();
  });

  it('does not carry value by key when id changed', () => {
    const view = makeView([makeNode({ id: 'field_456', key: 'email' })]);
    const data = makeData({ email: { value: 'test@example.com' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['field_456']).toBeUndefined();
    expect(result.reconciledState.values['email']).toBeUndefined();
  });

  it('prefers id matching over key matching when both are possible', () => {
    const view = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', key: 'a' }),
    ]);
    const data = makeData({ a: { value: 'hello' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    expect(result.reconciledState.values['b']).toBeUndefined();
  });

  it('does not match nested keys using scoped paths during blind carry', () => {
    const view = makeView([
      makeNode({
        id: 'form',
        type: 'group',
        children: [makeNode({ id: 'field_1', key: 'email' })],
      }),
    ]);
    const data = makeData({ 'form/email': { value: 'nested@example.com' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['form/field_1']).toBeUndefined();
    expect(result.reconciledState.values['form/email']).toBeUndefined();
  });

  it('drops values with no id or key match', () => {
    const view = makeView([makeNode({ id: 'field_456', key: 'email' })]);
    const data = makeData({ no_match: { value: 'gone' } });
    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['field_456']).toBeUndefined();
    expect(result.reconciledState.values['no_match']).toBeUndefined();
  });

  it('preserves detachedValues without carrying blindly by key', () => {
    const view = makeView([makeNode({ id: 'field_456', key: 'email' })]);
    const data = makeData(
      { email: { value: 'test@example.com' } },
      {},
      { email: { lastUpdated: 400, lastInteractionId: 'int-9' } }
    );
    data.detachedValues = {
      phone: {
        value: { value: '555-1234' },
        previousNodeType: 'field',
        key: 'phone',
        detachedAt: 300,
        viewVersion: '1.0',
        reason: 'node-removed',
      },
    };

    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.values['field_456']).toBeUndefined();
    expect(result.reconciledState.valueLineage?.['field_456']).toBeUndefined();
    expect(result.reconciledState.valueLineage?.['email']).toBeUndefined();
    expect(result.reconciledState.detachedValues).toEqual(data.detachedValues);
  });

  it('preserves detachedValues even when allowBlindCarry is false', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData({ a: { value: 'hello' } });
    data.detachedValues = {
      archived: {
        value: { value: 'saved' },
        previousNodeType: 'field',
        key: 'archived',
        detachedAt: 250,
        viewVersion: '1.0',
        reason: 'node-removed',
      },
    };

    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {},
    });

    expect(result.reconciledState.values).toEqual({});
    expect(result.reconciledState.detachedValues).toEqual(data.detachedValues);
  });

  it('preserves lineage fields and omits valueLineage when allowBlindCarry is false', () => {
    const view = makeView([makeNode({ id: 'a' })], 'new-view', '2.1');
    const data = makeData(
      { a: { value: 'hello' } },
      {
        sessionId: 'session-1',
        viewId: 'old-view',
        viewVersion: '1.0',
      },
      { a: { lastUpdated: 400, lastInteractionId: 'int-1' } }
    );

    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {},
    });

    expect(result.reconciledState.values).toEqual({});
    expect(result.reconciledState.lineage).toEqual({
      ...data.lineage,
      timestamp: 5000,
      viewId: 'new-view',
      viewVersion: '2.1',
    });
    expect(result.reconciledState.valueLineage).toBeUndefined();
  });

  it('carries valueLineage only for ids carried during blind carry', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData(
      { a: { value: 'hello' }, orphan: { value: 'gone' } },
      {},
      {
        a: { lastUpdated: 100, lastInteractionId: 'int-a' },
        orphan: { lastUpdated: 200, lastInteractionId: 'int-orphan' },
      }
    );

    const result = buildBlindCarryResult({
      newView: view,
      priorData: data,
      now: 5000,
      options: {
        allowBlindCarry: true,
      },
    });

    expect(result.reconciledState.valueLineage).toEqual({
      a: { lastUpdated: 100, lastInteractionId: 'int-a' },
    });
    expect(result.reconciledState.valueLineage?.['orphan']).toBeUndefined();
  });
});

describe('assembleReconciliationResult', () => {
  it('merges resolved and removal outputs into a single result', () => {
    const resolved = {
      values: { a: { value: 'hello' } as NodeValue },
      valueLineage: {},
      detachedValues: {},
      restoredDetachedKeys: new Set<string>(),
      diffs: [{ nodeId: 'a', type: 'added' as const }],
      resolutions: [],
      issues: [],
    };
    const removals = {
      diffs: [
        { nodeId: 'b', type: 'removed' as const, oldValue: { value: true } },
      ],
      issues: [
        {
          severity: 'warning' as const,
          nodeId: 'b',
          message: 'removed',
          code: 'NODE_REMOVED' as const,
        },
      ],
    };
    const priorData = makeData({ b: { value: true } });
    const view = makeView([makeNode({ id: 'a' })]);

    const result = assembleReconciliationResult({
      resolved,
      removals,
      priorData,
      newView: view,
      now: 5000,
    });

    expect(result.diffs).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
  });

  it('preserves deterministic diff and issue ordering', () => {
    const resolved = {
      values: { a: { value: 'hello' } as NodeValue },
      valueLineage: {},
      detachedValues: {},
      restoredDetachedKeys: new Set<string>(),
      diffs: [
        { nodeId: 'a', type: 'added' as const },
        { nodeId: 'c', type: 'added' as const },
      ],
      resolutions: [],
      issues: [
        {
          severity: 'info' as const,
          nodeId: 'a',
          message: 'resolved-a',
          code: 'UNVALIDATED_CARRY' as const,
        },
      ],
    };
    const removals = {
      diffs: [
        { nodeId: 'b', type: 'removed' as const, oldValue: { value: true } },
      ],
      issues: [
        {
          severity: 'warning' as const,
          nodeId: 'b',
          message: 'removed-b',
          code: 'NODE_REMOVED' as const,
        },
      ],
    };
    const priorData = makeData({ b: { value: true } });
    const view = makeView([makeNode({ id: 'a' })]);

    const result = assembleReconciliationResult({
      resolved,
      removals,
      priorData,
      newView: view,
      now: 5000,
    });

    expect(result.diffs.map((diff) => `${diff.type}:${diff.nodeId}`)).toEqual([
      'added:a',
      'added:c',
      'removed:b',
    ]);
    expect(result.issues.map((issue) => `${issue.code}:${issue.nodeId ?? ''}`)).toEqual([
      'UNVALIDATED_CARRY:a',
      'NODE_REMOVED:b',
    ]);
  });

  it('merges detached values and removes restored keys after merge', () => {
    const resolved = {
      values: { a: { value: 'hello' } as NodeValue },
      valueLineage: {},
      detachedValues: {
        kept: {
          value: { value: 'resolved' },
          previousNodeType: 'field' as const,
          key: 'kept',
          detachedAt: 100,
          viewVersion: '1.0',
          reason: 'node-removed' as const,
        },
        restored: {
          value: { value: 'resolved-restored' },
          previousNodeType: 'field' as const,
          key: 'restored',
          detachedAt: 110,
          viewVersion: '1.0',
          reason: 'node-removed' as const,
        },
      },
      restoredDetachedKeys: new Set<string>(['restored']),
      diffs: [],
      resolutions: [],
      issues: [],
    };
    const removals = {
      diffs: [],
      issues: [],
      detachedValues: {
        removed: {
          value: { value: 'removed' },
          previousNodeType: 'field' as const,
          key: 'removed',
          detachedAt: 120,
          viewVersion: '1.0',
          reason: 'node-removed' as const,
        },
        restored: {
          value: { value: 'removal-restored' },
          previousNodeType: 'field' as const,
          key: 'restored',
          detachedAt: 130,
          viewVersion: '1.0',
          reason: 'node-removed' as const,
        },
      },
    };
    const priorData = makeData({});
    priorData.detachedValues = {
      prior: {
        value: { value: 'prior' },
        previousNodeType: 'field',
        key: 'prior',
        detachedAt: 90,
        viewVersion: '0.9',
        reason: 'node-removed',
      },
      restored: {
        value: { value: 'prior-restored' },
        previousNodeType: 'field',
        key: 'restored',
        detachedAt: 95,
        viewVersion: '0.9',
        reason: 'node-removed',
      },
    };
    const view = makeView([makeNode({ id: 'a' })]);

    const result = assembleReconciliationResult({
      resolved,
      removals,
      priorData,
      newView: view,
      now: 5000,
    });

    expect(result.reconciledState.detachedValues).toEqual({
      prior: priorData.detachedValues.prior,
      kept: resolved.detachedValues.kept,
      removed: removals.detachedValues.removed,
    });
    expect(result.reconciledState.detachedValues?.['restored']).toBeUndefined();
  });
});

describe('carryValuesMeta', () => {
  it('copies prior lineage to the new id', () => {
    const target: Record<
      string,
      { lastUpdated?: number; lastInteractionId?: string }
    > = {};
    const data = makeData(
      {},
      {},
      { 'old-id': { lastUpdated: 500, lastInteractionId: 'int-1' } }
    );

    carryValuesMeta({
      target,
      newId: 'new-id',
      priorId: 'old-id',
      priorData: data,
      now: 9000,
      isMigrated: false,
    });

    expect(target['new-id']).toEqual({
      lastUpdated: 500,
      lastInteractionId: 'int-1',
    });
  });

  it('updates lastUpdated when migrated', () => {
    const target: Record<
      string,
      { lastUpdated?: number; lastInteractionId?: string }
    > = {};
    const data = makeData({}, {}, { a: { lastUpdated: 500 } });

    carryValuesMeta({
      target,
      newId: 'a',
      priorId: 'a',
      priorData: data,
      now: 9000,
      isMigrated: true,
    });

    expect(target['a'].lastUpdated).toBe(9000);
  });
});

describe('computeViewHash', () => {
  it('returns undefined when no nodes have hashes', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    expect(computeViewHash(view)).toBeUndefined();
  });

  it('produces a deterministic hash for equivalent views', () => {
    const viewA = makeView([
      makeNode({ id: 'a', hash: 'alpha' }),
      makeNode({ id: 'b', type: 'action', hash: 'beta' }),
    ]);
    const viewB = makeView([
      makeNode({ id: 'a', hash: 'alpha' }),
      makeNode({ id: 'b', type: 'action', hash: 'beta' }),
    ]);

    expect(computeViewHash(viewA)).toBe(computeViewHash(viewB));
  });

  it('produces different hashes for different structures with same node hashes', () => {
    const flat = makeView([
      makeNode({ id: 'a', hash: 'same' }),
      makeNode({ id: 'b', hash: 'same' }),
    ]);
    const nested = makeView([
      makeNode({
        id: 'a',
        type: 'group',
        hash: 'same',
        children: [makeNode({ id: 'b', hash: 'same' })],
      }),
    ]);

    expect(computeViewHash(flat)).not.toBe(computeViewHash(nested));
  });
});

describe('generateSessionId', () => {
  it('includes the timestamp in the id', () => {
    const id = generateSessionId(12345);
    expect(id).toContain('12345');
    expect(id).toMatch(/^session_/);
  });
});
