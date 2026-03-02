import { describe, expect, it } from 'vitest';
import type { DataSnapshot, NodeValue, ViewDefinition, ViewNode } from '@continuum/contract';
import { buildReconciliationContext } from '../context.js';
import { reconcile } from '../reconcile.js';

function makeView(nodes: ViewNode[], viewId = 'view-1', version = '1.0'): ViewDefinition {
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

function makeData(values: Record<string, NodeValue>): DataSnapshot {
  return {
    values,
    lineage: {
      timestamp: 1000,
      sessionId: 'test-session',
    },
  };
}

function makeScopedView(billingChildId = 'name', shippingChildId = 'name'): ViewDefinition {
  return makeView([
    makeNode({
      id: 'billing',
      type: 'group',
      children: [makeNode({ id: billingChildId, key: 'billing-name', type: 'field' })],
    }),
    makeNode({
      id: 'shipping',
      type: 'group',
      children: [makeNode({ id: shippingChildId, key: 'shipping-name', type: 'field' })],
    }),
  ]);
}

describe('scoped matching', () => {
  it('indexes duplicate child ids under different parents without duplicate ID errors', () => {
    const view = makeScopedView('name', 'name');
    const ctx = buildReconciliationContext(view, null);
    expect(ctx.newById.size).toBeGreaterThanOrEqual(4);
    expect(ctx.issues.some((issue) => issue.code === 'DUPLICATE_NODE_ID')).toBe(false);
  });

  it('carries both scoped child states independently', () => {
    const priorView = makeScopedView('name', 'name');
    const newView = makeScopedView('name', 'name');
    const priorData = makeData({
      'billing/name': { value: 'billing-user' },
      'shipping/name': { value: 'shipping-user' },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['billing/name']).toEqual({ value: 'billing-user' });
    expect(result.reconciledState.values['shipping/name']).toEqual({ value: 'shipping-user' });
  });

  it('does not produce duplicate key warnings when duplicate keys are in different parent scopes', () => {
    const view = makeView([
      makeNode({
        id: 'billing',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'name' })],
      }),
      makeNode({
        id: 'shipping',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'name' })],
      }),
    ]);
    const ctx = buildReconciliationContext(view, null);
    expect(ctx.issues.some((issue) => issue.code === 'DUPLICATE_NODE_KEY')).toBe(false);
  });

  it('preserves child state when parent id is renamed', () => {
    const priorView = makeView([
      makeNode({
        id: 'billing-old',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'billing-name' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'billing-new',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'billing-name' })],
      }),
    ]);
    const priorData = makeData({ 'billing-old/name': { value: 'kept' } });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['billing-new/name']).toEqual({ value: 'kept' });
  });

  it('preserves child state when moved to another parent by key', () => {
    const priorView = makeView([
      makeNode({
        id: 'billing',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'stable-name' })],
      }),
      makeNode({ id: 'shipping', type: 'group', children: [] }),
    ]);
    const newView = makeView([
      makeNode({ id: 'billing', type: 'group', children: [] }),
      makeNode({
        id: 'shipping',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'stable-name' })],
      }),
    ]);
    const priorData = makeData({ 'billing/name': { value: 'moved' } });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['shipping/name']).toEqual({ value: 'moved' });
  });

  it('works for 3-level nested duplicate ids', () => {
    const priorView = makeView([
      makeNode({
        id: 'rootA',
        type: 'group',
        children: [makeNode({ id: 'section', type: 'group', children: [makeNode({ id: 'name' })] })],
      }),
      makeNode({
        id: 'rootB',
        type: 'group',
        children: [makeNode({ id: 'section', type: 'group', children: [makeNode({ id: 'name' })] })],
      }),
    ]);
    const newView = priorView;
    const priorData = makeData({
      'rootA/section/name': { value: 'a' },
      'rootB/section/name': { value: 'b' },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['rootA/section/name']).toEqual({ value: 'a' });
    expect(result.reconciledState.values['rootB/section/name']).toEqual({ value: 'b' });
  });

  it('maintains backward compatibility for flat unique ids', () => {
    const priorView = makeView([makeNode({ id: 'email' }), makeNode({ id: 'phone' })]);
    const newView = makeView([makeNode({ id: 'email' }), makeNode({ id: 'phone' })]);
    const priorData = makeData({ email: { value: 'a@x.com' }, phone: { value: '123' } });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['email']).toEqual({ value: 'a@x.com' });
    expect(result.reconciledState.values['phone']).toEqual({ value: '123' });
  });

  it('handles mixed scoped and global unique ids in same view', () => {
    const priorView = makeView([
      makeNode({ id: 'global-email' }),
      makeNode({
        id: 'billing',
        type: 'group',
        children: [makeNode({ id: 'name' })],
      }),
      makeNode({
        id: 'shipping',
        type: 'group',
        children: [makeNode({ id: 'name' })],
      }),
    ]);
    const newView = priorView;
    const priorData = makeData({
      'global-email': { value: 'g@x.com' },
      'billing/name': { value: 'bill' },
      'shipping/name': { value: 'ship' },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['global-email']).toEqual({ value: 'g@x.com' });
    expect(result.reconciledState.values['billing/name']).toEqual({ value: 'bill' });
    expect(result.reconciledState.values['shipping/name']).toEqual({ value: 'ship' });
  });

  it('detects removal correctly for one scoped child only', () => {
    const priorView = makeScopedView('name', 'name');
    const newView = makeView([
      makeNode({
        id: 'billing',
        type: 'group',
        children: [makeNode({ id: 'name', key: 'billing-name' })],
      }),
      makeNode({
        id: 'shipping',
        type: 'group',
        children: [],
      }),
    ]);
    const priorData = makeData({
      'billing/name': { value: 'bill' },
      'shipping/name': { value: 'ship' },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.diffs.some((diff) => diff.nodeId === 'shipping/name' && diff.type === 'removed')).toBe(true);
    expect(result.reconciledState.values['billing/name']).toEqual({ value: 'bill' });
  });

  it('produces resolutions for both scoped duplicate ids', () => {
    const priorView = makeScopedView('name', 'name');
    const newView = makeScopedView('name', 'name');
    const priorData = makeData({
      'billing/name': { value: 'bill' },
      'shipping/name': { value: 'ship' },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.resolutions.some((r) => r.nodeId === 'billing/name')).toBe(true);
    expect(result.resolutions.some((r) => r.nodeId === 'shipping/name')).toBe(true);
  });
});
