import { describe, it, expect } from 'vitest';
import type { ViewNode, ViewDefinition, DataSnapshot, NodeValue } from '@continuum/contract';
import {
  buildFreshSessionResult,
  buildBlindCarryResult,
  assembleReconciliationResult,
  carryValuesMeta,
  computeViewHash,
  generateSessionId,
} from './state-builder.js';

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
    const result = buildFreshSessionResult(view, 5000);

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
    const result = buildFreshSessionResult(view, 5000);

    expect(result.diffs).toHaveLength(2);
    expect(result.diffs[0].nodeId).toBe('parent');
    expect(result.diffs[1].nodeId).toBe('child');
  });

  it('emits NO_PRIOR_DATA info issue', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const result = buildFreshSessionResult(view, 5000);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('NO_PRIOR_DATA');
  });
});

describe('buildBlindCarryResult', () => {
  it('drops all values when allowBlindCarry is false', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData({ a: { value: 'hello' } });
    const result = buildBlindCarryResult(view, data, 5000, {});

    expect(result.reconciledState.values).toEqual({});
    expect(result.issues[0].code).toBe('NO_PRIOR_VIEW');
  });

  it('carries matching values when allowBlindCarry is true', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const data = makeData({ a: { value: 'hello' }, orphan: { value: 'gone' } });
    const result = buildBlindCarryResult(view, data, 5000, { allowBlindCarry: true });

    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    expect(result.reconciledState.values['orphan']).toBeUndefined();
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
      diffs: [{ nodeId: 'b', type: 'removed' as const, oldValue: { value: true } }],
      issues: [{ severity: 'warning' as const, nodeId: 'b', message: 'removed', code: 'NODE_REMOVED' as const }],
    };
    const priorData = makeData({ b: { value: true } });
    const view = makeView([makeNode({ id: 'a' })]);

    const result = assembleReconciliationResult(resolved, removals, priorData, view, 5000);

    expect(result.diffs).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
  });
});

describe('carryValuesMeta', () => {
  it('copies prior lineage to the new id', () => {
    const target: Record<string, { lastUpdated?: number; lastInteractionId?: string }> = {};
    const data = makeData({}, {}, { 'old-id': { lastUpdated: 500, lastInteractionId: 'int-1' } });

    carryValuesMeta(target, 'new-id', 'old-id', data, 9000, false);

    expect(target['new-id']).toEqual({ lastUpdated: 500, lastInteractionId: 'int-1' });
  });

  it('updates lastUpdated when migrated', () => {
    const target: Record<string, { lastUpdated?: number; lastInteractionId?: string }> = {};
    const data = makeData({}, {}, { 'a': { lastUpdated: 500 } });

    carryValuesMeta(target, 'a', 'a', data, 9000, true);

    expect(target['a'].lastUpdated).toBe(9000);
  });
});

describe('computeViewHash', () => {
  it('returns undefined when no nodes have hashes', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    expect(computeViewHash(view)).toBeUndefined();
  });

  it('produces a deterministic hash from sorted node hashes', () => {
    const viewA = makeView([
      makeNode({ id: 'a', hash: 'alpha' }),
      makeNode({ id: 'b', type: 'action', hash: 'beta' }),
    ]);
    const viewB = makeView([
      makeNode({ id: 'b', type: 'action', hash: 'beta' }),
      makeNode({ id: 'a', hash: 'alpha' }),
    ]);

    expect(computeViewHash(viewA)).toBe(computeViewHash(viewB));
  });
});

describe('generateSessionId', () => {
  it('includes the timestamp in the id', () => {
    const id = generateSessionId(12345);
    expect(id).toContain('12345');
    expect(id).toMatch(/^session_/);
  });
});
