import { describe, it, expect } from 'vitest';
import type {
  ViewDefinition,
  ViewNode,
  DataSnapshot,
  NodeValue,
} from '@continuum-dev/contract';
import {
  buildReconciliationContext,
  buildPriorValueLookupByIdAndKey,
} from '../../context/index.js';
import { resolveAllNodes, detectRemovedNodes } from './index.js';

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
    key: overrides.key,
    hash: overrides.hash,
    hidden: overrides.hidden,
    migrations: overrides.migrations,
    type,
    ...(type === 'field' ? { dataType: 'string' } : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'collection'
      ? {
          template: {
            id: `${overrides.id}-tpl`,
            type: 'field',
            dataType: 'string',
          } as ViewNode,
        }
      : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...overrides,
  } as ViewNode;
}

function makeData(
  values: Record<string, NodeValue>,
  lineage?: Partial<DataSnapshot['lineage']>
): DataSnapshot {
  return {
    values,
    lineage: { timestamp: 1000, sessionId: 'test-session', ...lineage },
  };
}

describe('resolveAllNodes', () => {
  it('emits diffs and resolutions in deterministic traversal order', () => {
    const priorView = makeView([
      makeNode({ id: 'a', key: 'alpha' }),
      makeNode({ id: 'b', key: 'beta' }),
    ]);
    const newView = makeView([
      makeNode({ id: 'a', key: 'alpha' }),
      makeNode({ id: 'c', key: 'beta' }),
      makeNode({ id: 'd', type: 'action' }),
    ]);
    const priorData = makeData({
      a: { value: 'value-a' },
      b: { value: 'value-b' },
    });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.resolutions.map((item) => item.nodeId)).toEqual(['a', 'c', 'd']);
    expect(result.resolutions.map((item) => item.matchedBy)).toEqual([
      'id',
      'key',
      null,
    ]);
    expect(result.diffs.map((item) => `${item.nodeId}:${item.type}`)).toEqual([
      'd:added',
    ]);
  });

  it('produces stable resolver output for repeated identical inputs', () => {
    const priorView = makeView([makeNode({ id: 'old', key: 'email' })]);
    const newView = makeView([
      makeNode({ id: 'new', key: 'email' }),
      makeNode({ id: 'added', type: 'action' }),
    ]);
    const priorData = makeData({ old: { value: 'test@example.com' } });
    const ctxA = buildReconciliationContext(newView, priorView);
    const ctxB = buildReconciliationContext(newView, priorView);
    const priorValuesA = buildPriorValueLookupByIdAndKey(priorData, ctxA);
    const priorValuesB = buildPriorValueLookupByIdAndKey(priorData, ctxB);

    const first = resolveAllNodes(ctxA, priorValuesA, priorData, 5000, {});
    const second = resolveAllNodes(ctxB, priorValuesB, priorData, 5000, {});

    expect(first).toEqual(second);
  });

  it('marks new nodes as added', () => {
    const priorView = makeView([makeNode({ id: 'a' })]);
    const newView = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', type: 'action' }),
    ]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    const added = result.diffs.find((d) => d.nodeId === 'b');
    expect(added).toBeDefined();
    expect(added!.type).toBe('added');
  });

  it('carries state for id-matched nodes', () => {
    const view = makeView([makeNode({ id: 'a' })]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(view, view);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'hello' });
    expect(result.resolutions[0].resolution).toBe('carried');
    expect(result.resolutions[0].matchedBy).toBe('id');
  });

  it('carries state for key-matched nodes when id changes', () => {
    const priorView = makeView([makeNode({ id: 'old', key: 'email' })]);
    const newView = makeView([makeNode({ id: 'new', key: 'email' })]);
    const priorData = makeData({ old: { value: 'test@example.com' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['new']).toEqual({ value: 'test@example.com' });
    expect(result.resolutions[0].matchedBy).toBe('key');
  });

  it('drops state and issues TYPE_MISMATCH on type change', () => {
    const priorView = makeView([makeNode({ id: 'a' })]);
    const newView = makeView([makeNode({ id: 'a', type: 'action' })]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toBeUndefined();
    expect(result.issues[0].code).toBe('TYPE_MISMATCH');
    expect(result.resolutions[0].resolution).toBe('detached');
  });

  it('carries state and warns when hash changes without a strategy', () => {
    const priorView = makeView([makeNode({ id: 'a', hash: 'v1' })]);
    const newView = makeView([makeNode({ id: 'a', hash: 'v2' })]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'hello' });
    expect(result.diffs).toEqual([]);
    expect(result.resolutions[0].resolution).toBe('carried');
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'MIGRATION_FAILED', severity: 'warning' })
    );
  });

  it('routes AI default values to suggestion when field is dirty', () => {
    const priorView = makeView([makeNode({ id: 'a', defaultValue: 'old' })]);
    const newView = makeView([makeNode({ id: 'a', defaultValue: 'new' })]);
    const priorData = makeData({ a: { value: 'user-edit', isDirty: true } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({
      value: 'user-edit',
      isDirty: true,
      suggestion: 'new',
    });
  });

  it('overwrites value with AI default when field is clean', () => {
    const priorView = makeView([makeNode({ id: 'a', defaultValue: 'old' })]);
    const newView = makeView([makeNode({ id: 'a', defaultValue: 'new' })]);
    const priorData = makeData({ a: { value: 'old', isDirty: false } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'new', isDirty: false });
    expect(
      result.diffs.some(
        (diff) => diff.nodeId === 'a' && diff.type === 'migrated'
      )
    ).toBe(true);
    expect(result.resolutions[0].reconciledValue).toEqual({
      value: 'new',
      isDirty: false,
    });
  });

  it('does not migrate when object default values are semantically equal', () => {
    const priorView = makeView([
      makeNode({
        id: 'a',
        defaultValue: { first: 1, second: 2 } as unknown as string,
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'a',
        defaultValue: { second: 2, first: 1 } as unknown as string,
      }),
    ]);
    const priorData = makeData({
      a: { value: { first: 1, second: 2 }, isDirty: true } as NodeValue,
    });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({
      value: { first: 1, second: 2 },
      isDirty: true,
    });
    expect(
      result.diffs.find(
        (diff) => diff.nodeId === 'a' && diff.type === 'migrated'
      )
    ).toBeUndefined();
    expect(result.resolutions[0].reconciledValue).toEqual({
      value: { first: 1, second: 2 },
      isDirty: true,
    });
  });

  it('does not overwrite a clean value when object default values only differ by property order', () => {
    const priorView = makeView([
      makeNode({
        id: 'a',
        defaultValue: { first: 1, second: 2 } as unknown as string,
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'a',
        defaultValue: { second: 2, first: 1 } as unknown as string,
      }),
    ]);
    const priorData = makeData({
      a: { value: { first: 1, second: 2 }, isDirty: false } as NodeValue,
    });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({
      value: { first: 1, second: 2 },
      isDirty: false,
    });
    expect(
      result.diffs.find(
        (diff) => diff.nodeId === 'a' && diff.type === 'migrated'
      )
    ).toBeUndefined();
  });

  it('carries state between compatible container types (row -> group)', () => {
    const priorView = makeView([
      makeNode({ id: 'a', type: 'row', children: [] } as any),
    ]);
    const newView = makeView([
      makeNode({ id: 'a', type: 'group', children: [] } as any),
    ]);
    const priorData = makeData({ a: { value: 'container-state' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'container-state' });
    expect(result.resolutions[0].resolution).toBe('carried');
  });

  it('restores detached values when a node is re-added with the same key and type', () => {
    const priorView = makeView([]);
    const newView = makeView([
      makeNode({ id: 'a', key: 'email', type: 'field' }),
    ]);

    // Simulate a snapshot that has a detached value for 'email'
    const priorData = makeData({});
    priorData.detachedValues = {
      email: {
        value: { value: 'test@detached.com' },
        previousNodeType: 'field',
        key: 'email',
        detachedAt: 1000,
        viewVersion: '1.0',
        reason: 'node-removed',
      },
    };

    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'test@detached.com' });
    expect(result.diffs[0].type).toBe('restored');
    expect(result.resolutions[0].resolution).toBe('restored');
  });

  it('creates a detached value when a type mismatch occurs', () => {
    const priorView = makeView([
      makeNode({ id: 'a', type: 'field', key: 'email' }),
    ]);
    const newView = makeView([
      makeNode({ id: 'a', type: 'action', key: 'email' }),
    ]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toBeUndefined();
    expect(result.detachedValues['email']).toBeDefined();
    expect(result.detachedValues['email'].value).toEqual({ value: 'hello' });
    expect(result.detachedValues['email'].reason).toBe('type-mismatch');
  });
});

describe('detectRemovedNodes', () => {
  it('detects nodes that no longer exist in the new view', () => {
    const priorView = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', type: 'action' }),
    ]);
    const newView = makeView([makeNode({ id: 'a' })]);
    const priorData = makeData({ a: { value: 'hello' }, b: { value: true } });
    const ctx = buildReconciliationContext(newView, priorView);

    const result = detectRemovedNodes(ctx, priorData, {}, 5000);

    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].nodeId).toBe('b');
    expect(result.diffs[0].type).toBe('removed');
    expect(result.issues[0].code).toBe('NODE_REMOVED');
  });

  it('suppresses NODE_REMOVED issue when allowPartialRestore is true', () => {
    const priorView = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', type: 'action' }),
    ]);
    const newView = makeView([makeNode({ id: 'a' })]);
    const priorData = makeData({ a: { value: 'hello' }, b: { value: true } });
    const ctx = buildReconciliationContext(newView, priorView);

    const result = detectRemovedNodes(
      ctx,
      priorData,
      { allowPartialRestore: true },
      5000
    );

    expect(result.diffs).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it('does not flag key-matched nodes as removed', () => {
    const priorView = makeView([makeNode({ id: 'old', key: 'email' })]);
    const newView = makeView([makeNode({ id: 'new', key: 'email' })]);
    const priorData = makeData({ old: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);

    const result = detectRemovedNodes(ctx, priorData, {}, 5000);

    expect(result.diffs).toHaveLength(0);
  });
});
