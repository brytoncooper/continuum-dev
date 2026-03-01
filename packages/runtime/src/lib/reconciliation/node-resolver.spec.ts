import { describe, it, expect } from 'vitest';
import type { ViewDefinition, ViewNode, DataSnapshot, NodeValue } from '@continuum/contract';
import { buildReconciliationContext, buildPriorValueLookupByIdAndKey } from '../context.js';
import { resolveAllNodes, detectRemovedNodes } from './node-resolver.js';

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
    ...(type === 'collection'
      ? { template: { id: `${overrides.id}-tpl`, type: 'field', dataType: 'string' } as ViewNode }
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

  it('migrates state when hash changes and same type', () => {
    const priorView = makeView([makeNode({ id: 'a', hash: 'v1' })]);
    const newView = makeView([makeNode({ id: 'a', hash: 'v2' })]);
    const priorData = makeData({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newView, priorView);
    const priorValues = buildPriorValueLookupByIdAndKey(priorData, ctx);

    const result = resolveAllNodes(ctx, priorValues, priorData, 5000, {});

    expect(result.values['a']).toEqual({ value: 'hello' });
    expect(result.diffs[0].type).toBe('migrated');
    expect(result.resolutions[0].resolution).toBe('migrated');
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

    const result = detectRemovedNodes(ctx, priorData, { allowPartialRestore: true }, 5000);

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
