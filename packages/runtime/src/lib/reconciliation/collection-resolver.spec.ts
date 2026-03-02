import { describe, expect, it } from 'vitest';
import type { DataSnapshot, NodeValue, ViewDefinition, ViewNode } from '@continuum/contract';
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

function makeData(
  values: Record<string, NodeValue>,
  lineage?: Partial<DataSnapshot['lineage']>
): DataSnapshot {
  return {
    values,
    lineage: {
      timestamp: 1000,
      sessionId: 'test-session',
      ...lineage,
    },
  };
}

function collectionNode(id: string, overrides?: Partial<ViewNode>): ViewNode {
  return makeNode({
    id,
    type: 'collection',
    template: makeNode({ id: `${id}-item-value`, type: 'field', dataType: 'string' }),
    ...(overrides ?? {}),
  });
}

describe('collection reconciliation', () => {
  it('creates empty items state for collection on fresh session', () => {
    const view = makeView([collectionNode('addresses')]);
    const result = reconcile(view, null, null);
    expect(result.reconciledState.values['addresses']).toEqual({ value: { items: [] } });
  });

  it('honors minItems on fresh session and creates seeded items', () => {
    const view = makeView([collectionNode('addresses', { minItems: 2 })]);
    const result = reconcile(view, null, null);
    expect((result.reconciledState.values['addresses'] as NodeValue).value).toEqual({
      items: [{ values: {} }, { values: {} }],
    });
  });

  it('carries collection items across unchanged view transition', () => {
    const priorView = makeView([collectionNode('addresses')], 'view-1', '1.0');
    const newView = makeView([collectionNode('addresses')], 'view-1', '2.0');
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'home' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    expect((result.reconciledState.values['addresses'] as NodeValue).value).toEqual({
      items: [{ values: { 'addresses-item-value': { value: 'home' } } }],
    });
  });

  it('retains item order after reconciliation', () => {
    const priorView = makeView([collectionNode('addresses')], 'view-1', '1.0');
    const newView = makeView([collectionNode('addresses')], 'view-1', '2.0');
    const priorData = makeData({
      addresses: {
        value: {
          items: [
            { values: { 'addresses-item-value': { value: 'first' } } },
            { values: { 'addresses-item-value': { value: 'second' } } },
          ],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = ((result.reconciledState.values['addresses'] as NodeValue).value as { items: Array<{ values: Record<string, NodeValue> }> }).items;
    expect(items[0].values['addresses-item-value']).toEqual({ value: 'first' });
    expect(items[1].values['addresses-item-value']).toEqual({ value: 'second' });
  });

  it('enforces maxItems by truncating overflow items', () => {
    const priorView = makeView([collectionNode('addresses', { maxItems: 2 })], 'view-1', '1.0');
    const newView = makeView([collectionNode('addresses', { maxItems: 2 })], 'view-1', '2.0');
    const priorData = makeData({
      addresses: {
        value: {
          items: [
            { values: { 'addresses-item-value': { value: 'a' } } },
            { values: { 'addresses-item-value': { value: 'b' } } },
            { values: { 'addresses-item-value': { value: 'c' } } },
          ],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = ((result.reconciledState.values['addresses'] as NodeValue).value as { items: Array<{ values: Record<string, NodeValue> }> }).items;
    expect(items).toHaveLength(2);
  });

  it('enforces minItems by seeding missing items on carry', () => {
    const priorView = makeView([collectionNode('addresses', { minItems: 3 })], 'view-1', '1.0');
    const newView = makeView([collectionNode('addresses', { minItems: 3 })], 'view-1', '2.0');
    const priorData = makeData({
      addresses: { value: { items: [{ values: { 'addresses-item-value': { value: 'a' } } }] } },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = ((result.reconciledState.values['addresses'] as NodeValue).value as { items: Array<{ values: Record<string, NodeValue> }> }).items;
    expect(items).toHaveLength(3);
    expect(items[0].values['addresses-item-value']).toEqual({ value: 'a' });
  });

  it('preserves collection by key when id changes', () => {
    const priorView = makeView([collectionNode('addresses-old', { key: 'addresses-key' })], 'view-1', '1.0');
    const newView = makeView([collectionNode('addresses-new', { key: 'addresses-key' })], 'view-1', '2.0');
    const priorData = makeData({
      'addresses-old': {
        value: { items: [{ values: { 'addresses-old-item-value': { value: 'persisted' } } }] },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['addresses-new']).toBeDefined();
  });

  it('applies migration to each item when template hash changes', () => {
    const priorView = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'addresses-item-value', type: 'field', hash: 'v1' }),
        hash: 'collection-v1',
      }),
    ]);
    const newView = makeView([
      collectionNode('addresses', {
        template: makeNode({
          id: 'addresses-item-value',
          type: 'field',
          hash: 'v2',
          migrations: [{ fromHash: 'v1', toHash: 'v2', strategyId: 'to-upper' }],
        }),
        hash: 'collection-v2',
      }),
    ]);
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'main' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData, {
      strategyRegistry: {
        'to-upper': (_nodeId, _priorNode, _newNode, priorValue) => {
          const nodeValue = priorValue as NodeValue<string>;
          return { value: nodeValue.value.toUpperCase() };
        },
      },
    });
    const items = ((result.reconciledState.values['addresses'] as NodeValue).value as { items: Array<{ values: Record<string, NodeValue> }> }).items;
    expect(items[0].values['addresses-item-value']).toEqual({ value: 'MAIN' });
  });

  it('detaches collection state when template type changes', () => {
    const priorView = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'addresses-item-value', type: 'field' }),
      }),
    ]);
    const newView = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'addresses-item-value', type: 'action' }),
      }),
    ]);
    const priorData = makeData({
      addresses: { value: { items: [{ values: { 'addresses-item-value': { value: 'main' } } }] } },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.issues.some((issue) => issue.code === 'TYPE_MISMATCH')).toBe(true);
    expect((result.reconciledState.values['addresses'] as NodeValue).value).toEqual({ items: [] });
  });

  it('supports nested collections in collection templates', () => {
    const nestedTemplate = collectionNode('phones');
    const view = makeView([
      collectionNode('addresses', {
        template: makeNode({
          id: 'address-item',
          type: 'group',
          children: [makeNode({ id: 'street', type: 'field' }), nestedTemplate],
        }),
      }),
    ]);
    const result = reconcile(view, null, null);
    expect((result.reconciledState.values['addresses'] as NodeValue).value).toEqual({ items: [] });
  });

  it('supports empty collection state as valid input', () => {
    const priorView = makeView([collectionNode('addresses')]);
    const newView = makeView([collectionNode('addresses')]);
    const priorData = makeData({ addresses: { value: { items: [] } } });
    const result = reconcile(newView, priorView, priorData);
    expect((result.reconciledState.values['addresses'] as NodeValue).value).toEqual({ items: [] });
  });
});
