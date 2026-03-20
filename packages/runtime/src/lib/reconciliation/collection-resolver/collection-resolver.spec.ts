import { describe, expect, it } from 'vitest';
import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { reconcile as runtimeReconcile } from '../../reconcile/index.js';
import type { ReconciliationOptions } from '../../types.js';

const TEST_NOW = 2000;

function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions = {}
) {
  return runtimeReconcile({
    newView,
    priorView,
    priorData,
    options: {
      clock: () => TEST_NOW,
      ...options,
    },
  });
}

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
    template: makeNode({
      id: `${id}-item-value`,
      type: 'field',
      dataType: 'string',
    }),
    ...(overrides ?? {}),
  });
}

describe('collection reconciliation', () => {
  it('creates empty items state for collection on initial snapshot', () => {
    const view = makeView([collectionNode('addresses')]);
    const result = reconcile(view, null, null);
    expect(result.reconciledState.values['addresses']).toEqual({
      value: { items: [] },
    });
  });

  it('honors minItems on fresh session and creates seeded items', () => {
    const view = makeView([collectionNode('addresses', { minItems: 2 })]);
    const result = reconcile(view, null, null);
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({
      items: [{ values: {} }, { values: {} }],
    });
  });

  it('applies template defaults to minItems seed values', () => {
    const view = makeView([
      collectionNode('addresses', {
        minItems: 2,
        template: makeNode({
          id: 'address-item',
          type: 'group',
          children: [
            makeNode({
              id: 'city',
              type: 'field',
              dataType: 'string',
              defaultValue: 'Paris',
            }),
            makeNode({
              id: 'zip',
              type: 'field',
              dataType: 'number',
              defaultValue: 75001,
            }),
          ],
        }),
      }),
    ]);
    const result = reconcile(view, null, null);
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({
      items: [
        {
          values: {
            'address-item/city': { value: 'Paris' },
            'address-item/zip': { value: 75001 },
          },
        },
        {
          values: {
            'address-item/city': { value: 'Paris' },
            'address-item/zip': { value: 75001 },
          },
        },
      ],
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
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({
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
    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items[0].values['addresses-item-value']).toEqual({ value: 'first' });
    expect(items[1].values['addresses-item-value']).toEqual({
      value: 'second',
    });
  });

  it('enforces maxItems by truncating overflow items', () => {
    const priorView = makeView(
      [collectionNode('addresses', { maxItems: 2 })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [collectionNode('addresses', { maxItems: 2 })],
      'view-1',
      '2.0'
    );
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
    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(2);
  });

  it('enforces minItems by seeding missing items on carry', () => {
    const priorView = makeView(
      [collectionNode('addresses', { minItems: 3 })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [collectionNode('addresses', { minItems: 3 })],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'a' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(3);
    expect(items[0].values['addresses-item-value']).toEqual({ value: 'a' });
  });

  it('emits constraint issues in deterministic max-then-min order', () => {
    const priorView = makeView(
      [collectionNode('addresses', { minItems: 3, maxItems: 1 })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [collectionNode('addresses', { minItems: 3, maxItems: 1 })],
      'view-1',
      '2.0'
    );
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
    const issues = result.issues.filter((issue) => issue.nodeId === 'addresses');

    expect(issues).toHaveLength(3);
    expect(issues[0]).toMatchObject({
      code: 'COLLECTION_CONSTRAINT_VIOLATED',
      severity: 'warning',
      message: 'Collection addresses exceeded maxItems',
    });
    expect(issues[1]).toMatchObject({
      code: 'COLLECTION_CONSTRAINT_VIOLATED',
      severity: 'info',
      message: 'Collection addresses filled to minItems',
    });
    expect(issues[2]).toMatchObject({
      code: 'COLLECTION_CONSTRAINT_VIOLATED',
      severity: 'info',
      message: 'Collection addresses filled to minItems',
    });
  });

  it('keeps carried resolution when collection content is unchanged', () => {
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

    expect(
      result.diffs.find(
        (diff) => diff.nodeId === 'addresses' && diff.type === 'migrated'
      )
    ).toBeUndefined();
    expect(
      result.resolutions.find(
        (resolution) =>
          resolution.nodeId === 'addresses' && resolution.resolution === 'carried'
      )
    ).toBeDefined();
  });

  it('seeds minItems carry padding with template defaults', () => {
    const priorView = makeView(
      [
        collectionNode('addresses', {
          minItems: 3,
          template: makeNode({
            id: 'address-item',
            type: 'group',
            children: [
              makeNode({
                id: 'city',
                type: 'field',
                dataType: 'string',
                defaultValue: 'Paris',
              }),
            ],
          }),
        }),
      ],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [
        collectionNode('addresses', {
          minItems: 3,
          template: makeNode({
            id: 'address-item',
            type: 'group',
            children: [
              makeNode({
                id: 'city',
                type: 'field',
                dataType: 'string',
                defaultValue: 'Paris',
              }),
            ],
          }),
        }),
      ],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'address-item/city': { value: 'Rome' } } }],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;

    expect(items).toHaveLength(3);
    expect(items[0].values['address-item/city']).toEqual({ value: 'Rome' });
    expect(items[1].values['address-item/city']).toEqual({ value: 'Paris' });
    expect(items[2].values['address-item/city']).toEqual({ value: 'Paris' });
  });

  it('preserves collection by key when id changes', () => {
    const priorView = makeView(
      [collectionNode('addresses-old', { key: 'addresses-key' })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [collectionNode('addresses-new', { key: 'addresses-key' })],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      'addresses-old': {
        value: {
          items: [
            { values: { 'addresses-old-item-value': { value: 'persisted' } } },
          ],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['addresses-new']).toBeDefined();
  });

  it('applies migration to each item when template hash changes', () => {
    const priorView = makeView([
      collectionNode('addresses', {
        template: makeNode({
          id: 'addresses-item-value',
          type: 'field',
          hash: 'v1',
        }),
        hash: 'collection-v1',
      }),
    ]);
    const newView = makeView([
      collectionNode('addresses', {
        template: makeNode({
          id: 'addresses-item-value',
          type: 'field',
          hash: 'v2',
          migrations: [
            { fromHash: 'v1', toHash: 'v2', strategyId: 'to-upper' },
          ],
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
        'to-upper': ({ priorValue }) => {
          const nodeValue = priorValue as NodeValue<string>;
          return { value: nodeValue.value.toUpperCase() };
        },
      },
    });
    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
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
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'main' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.issues.some((issue) => issue.code === 'TYPE_MISMATCH')).toBe(
      true
    );
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({ items: [] });
  });

  it('prioritizes type-mismatch guard over updated defaults branch', () => {
    const priorView = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'addresses-item-value', type: 'field' }),
        defaultValues: [{ 'addresses-item-value': 'first' }],
      }),
    ]);
    const newView = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'addresses-item-value', type: 'action' }),
        defaultValues: [{ 'addresses-item-value': 'replacement' }],
      }),
    ]);
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'main' } } }],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);

    expect(result.issues.map((issue) => issue.code)).toContain('TYPE_MISMATCH');
    expect(result.issues.map((issue) => issue.code)).not.toContain(
      'COLLECTION_CONSTRAINT_VIOLATED'
    );
    expect(result.reconciledState.values['addresses']).toEqual({
      value: {
        items: [
          {
            values: {
              'addresses-item-value': { value: 'replacement' },
            },
          },
        ],
      },
    });
    expect(
      result.diffs.find(
        (diff) => diff.nodeId === 'addresses' && diff.type === 'migrated'
      )
    ).toBeUndefined();
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
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({ items: [] });
  });

  it('supports empty collection state as valid input', () => {
    const priorView = makeView([collectionNode('addresses')]);
    const newView = makeView([collectionNode('addresses')]);
    const priorData = makeData({ addresses: { value: { items: [] } } });
    const result = reconcile(newView, priorView, priorData);
    expect(
      (result.reconciledState.values['addresses'] as NodeValue).value
    ).toEqual({ items: [] });
  });

  it('remaps item values when template container id changes but key stays', () => {
    const priorTpl = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({
          id: 'row_old',
          type: 'row',
          key: 'layout',
          children: [
            makeNode({ id: 'weight', key: 'weight', dataType: 'number' }),
            makeNode({ id: 'reps', key: 'reps', dataType: 'number' }),
          ],
        }),
      ],
    });
    const newTpl = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({
          id: 'row_new',
          type: 'row',
          key: 'layout',
          children: [
            makeNode({ id: 'weight', key: 'weight', dataType: 'number' }),
            makeNode({ id: 'reps', key: 'reps', dataType: 'number' }),
          ],
        }),
      ],
    });
    const priorView = makeView(
      [makeNode({ id: 'sets', type: 'collection', template: priorTpl })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [makeNode({ id: 'sets', type: 'collection', template: newTpl })],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      sets: {
        value: {
          items: [
            {
              values: {
                'tpl/row_old/weight': { value: 225 },
                'tpl/row_old/reps': { value: 8 },
              },
            },
          ],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = (
      (result.reconciledState.values['sets'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(1);
    expect(items[0].values['tpl/row_new/weight']).toEqual({ value: 225 });
    expect(items[0].values['tpl/row_new/reps']).toEqual({ value: 8 });
  });

  it('preserves item values when template is completely unchanged', () => {
    const tpl = makeNode({
      id: 'tpl',
      type: 'group',
      children: [makeNode({ id: 'name', key: 'name' })],
    });
    const priorView = makeView(
      [makeNode({ id: 'col', type: 'collection', template: tpl })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [makeNode({ id: 'col', type: 'collection', template: tpl })],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      col: {
        value: {
          items: [{ values: { 'tpl/name': { value: 'Alice' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = (
      (result.reconciledState.values['col'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items[0].values['tpl/name']).toEqual({ value: 'Alice' });
  });

  it('handles template with row→grid type change + id change via key', () => {
    const priorTpl = makeNode({
      id: 'tpl',
      type: 'row',
      key: 'tpl_key',
      children: [makeNode({ id: 'f', key: 'field_key' })],
    });
    const newTpl = makeNode({
      id: 'card',
      type: 'grid',
      key: 'tpl_key',
      children: [makeNode({ id: 'f', key: 'field_key' })],
    });
    const priorView = makeView(
      [makeNode({ id: 'col', type: 'collection', template: priorTpl })],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [makeNode({ id: 'col', type: 'collection', template: newTpl })],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      col: {
        value: {
          items: [{ values: { 'tpl/f': { value: 'data' } } }],
        },
      },
    });
    const result = reconcile(newView, priorView, priorData);
    const items = (
      (result.reconciledState.values['col'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(1);
    // Value path changes from tpl/f to card/f
    expect(items[0].values['card/f']).toEqual({ value: 'data' });
  });

  it('resets items when template root type changes (field→group)', () => {
    const priorView = makeView(
      [
        collectionNode('col', {
          template: makeNode({ id: 'item', type: 'field' }),
        }),
      ],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [
        makeNode({
          id: 'col',
          type: 'collection',
          template: makeNode({ id: 'item', type: 'group', children: [] }),
        }),
      ],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      col: { value: { items: [{ values: { item: { value: 'old' } } }] } },
    });
    const result = reconcile(newView, priorView, priorData);
    expect(result.issues.some((i) => i.code === 'TYPE_MISMATCH')).toBe(true);
  });

  it('populates initial items from defaultValues array on initial snapshot', () => {
    const view = makeView([
      collectionNode('addresses', {
        template: makeNode({ id: 'val', type: 'field' }),
        defaultValues: [{ val: 'first' }, { val: 'second' }],
      }),
    ]);
    const result = reconcile(view, null, null);

    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(2);
    expect(items[0].values['val']).toEqual({ value: 'first' });
    expect(items[1].values['val']).toEqual({ value: 'second' });
  });

  it('keeps dirty collection items as value and moves new defaultValues into suggestion', () => {
    const priorView = makeView(
      [
        collectionNode('addresses', {
          template: makeNode({ id: 'val', type: 'field' }),
          defaultValues: [{ val: 'first' }],
        }),
      ],
      'view-1',
      '1.0'
    );
    const newView = makeView(
      [
        collectionNode('addresses', {
          template: makeNode({ id: 'val', type: 'field' }),
          defaultValues: [{ val: 'replacement-1' }, { val: 'replacement-2' }],
        }),
      ],
      'view-1',
      '2.0'
    );
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { val: { value: 'custom', isDirty: true } } }],
        },
        isDirty: true,
      },
    });

    const result = reconcile(newView, priorView, priorData);

    expect(result.reconciledState.values['addresses']).toEqual({
      value: {
        items: [{ values: { val: { value: 'custom', isDirty: true } } }],
      },
      suggestion: {
        items: [
          { values: { val: { value: 'replacement-1' } } },
          { values: { val: { value: 'replacement-2' } } },
        ],
      },
      isDirty: true,
    });
    expect(result.diffs).toContainEqual(
      expect.objectContaining({
        nodeId: 'addresses',
        type: 'migrated',
      })
    );
  });

  it('retains dirty state on existing collection items during carry', () => {
    const priorView = makeView([collectionNode('addresses')]);
    const newView = makeView([collectionNode('addresses')]);

    // Simulate user editing an item
    const priorData = makeData({
      addresses: {
        value: {
          items: [
            {
              values: {
                'addresses-item-value': { value: 'dirty-value', isDirty: true },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);

    const items = (
      (result.reconciledState.values['addresses'] as NodeValue).value as {
        items: Array<{ values: Record<string, NodeValue> }>;
      }
    ).items;
    expect(items).toHaveLength(1);
    expect(items[0].values['addresses-item-value']).toEqual({
      value: 'dirty-value',
      isDirty: true,
    });
  });

  it('preserves top-level collection metadata during unchanged carry', () => {
    const priorView = makeView([collectionNode('addresses')]);
    const newView = makeView([collectionNode('addresses')]);
    const priorData = makeData({
      addresses: {
        value: {
          items: [{ values: { 'addresses-item-value': { value: 'home' } } }],
        },
        isDirty: true,
        isValid: false,
        suggestion: {
          items: [{ values: { 'addresses-item-value': { value: 'work' } } }],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);

    expect(result.reconciledState.values['addresses']).toEqual({
      value: {
        items: [{ values: { 'addresses-item-value': { value: 'home' } } }],
      },
      isDirty: true,
      isValid: false,
      suggestion: {
        items: [{ values: { 'addresses-item-value': { value: 'work' } } }],
      },
    });
  });

  describe.skip('cross-level key migration', () => {
    it('injects prior top-level value into first collection item when node moves into collection via key', () => {
      const priorView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'user_name',
            defaultValue: '',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'tasks',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({
                  id: 'assignee',
                  type: 'field',
                  key: 'user_name',
                  dataType: 'string',
                }),
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        user_name: { value: 'Alice', isDirty: true },
        tasks: {
          value: {
            items: [{ values: { 'task_item/title': { value: 'Task 1' } } }],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = (
        (result.reconciledState.values['tasks'] as NodeValue).value as {
          items: Array<{ values: Record<string, NodeValue> }>;
        }
      ).items;

      expect(items).toHaveLength(1);
      expect(items[0].values['task_item/assignee']).toEqual({
        value: undefined,
        suggestion: 'Alice',
        isDirty: true,
      });
      expect(items[0].values['task_item/title']).toEqual({ value: 'Task 1' });
      expect(result.reconciledState.values['user_name']).toBeUndefined();
    });

    it('preserves moved top-level user data as the seeded item value', () => {
      const priorView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'user_name',
            defaultValue: '',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'tasks',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({
                  id: 'assignee',
                  type: 'field',
                  key: 'user_name',
                  dataType: 'string',
                  defaultValue: '',
                }),
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        user_name: { value: 'Alice', isDirty: true },
        tasks: { value: { items: [] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = (
        (result.reconciledState.values['tasks'] as NodeValue).value as {
          items: Array<{ values: Record<string, NodeValue> }>;
        }
      ).items;

      expect(items).toHaveLength(1);
      expect(items[0].values['task_item/assignee']).toEqual({
        value: 'Alice',
        isDirty: true,
      });
      expect(result.reconciledState.values['user_name']).toBeUndefined();
    });

    it('injects prior top-level value into all existing collection items when node moves into collection', () => {
      const priorView = makeView(
        [
          makeNode({
            id: 'status',
            type: 'field',
            key: 'status',
            defaultValue: 'active',
          }),
          makeNode({
            id: 'items',
            type: 'collection',
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({ id: 'name', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'items',
            type: 'collection',
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({ id: 'name', type: 'field', dataType: 'string' }),
                makeNode({
                  id: 'item_status',
                  type: 'field',
                  key: 'status',
                  dataType: 'string',
                }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived', isDirty: true },
        items: {
          value: {
            items: [
              { values: { 'row/name': { value: 'First' } } },
              { values: { 'row/name': { value: 'Second' } } },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = (
        (result.reconciledState.values['items'] as NodeValue).value as {
          items: Array<{ values: Record<string, NodeValue> }>;
        }
      ).items;

      expect(items).toHaveLength(2);
      expect(items[0].values['row/item_status']).toEqual({
        value: undefined,
        suggestion: 'archived',
        isDirty: true,
      });
      expect(items[0].values['row/name']).toEqual({ value: 'First' });
      expect(items[1].values['row/item_status']).toEqual({
        value: undefined,
        suggestion: 'archived',
        isDirty: true,
      });
      expect(items[1].values['row/name']).toEqual({ value: 'Second' });
      expect(result.reconciledState.values['status']).toBeUndefined();
    });

    it('extracts value from first collection item when node moves from collection to top-level via key', () => {
      const priorView = makeView(
        [
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({
                  id: 'assignee',
                  type: 'field',
                  key: 'user_name',
                  dataType: 'string',
                }),
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'user_name',
            dataType: 'string',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'task_item',
              type: 'group',
              children: [
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        tasks: {
          value: {
            items: [
              {
                values: {
                  'task_item/assignee': { value: 'Bob', isDirty: true },
                  'task_item/title': { value: 'Do stuff' },
                },
              },
              {
                values: {
                  'task_item/assignee': { value: 'Carol' },
                  'task_item/title': { value: 'More stuff' },
                },
              },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({
        value: undefined,
        suggestion: 'Bob',
        isDirty: true,
      });
    });

    it('does not inject cross-level value when types do not match', () => {
      const priorView = makeView(
        [
          makeNode({
            id: 'counter',
            type: 'field',
            key: 'counter',
            dataType: 'number',
          }),
          makeNode({
            id: 'items',
            type: 'collection',
            template: makeNode({ id: 'row', type: 'group', children: [] }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'items',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({
                  id: 'counter',
                  type: 'collection',
                  key: 'counter',
                  template: makeNode({
                    id: 'c_item',
                    type: 'field',
                    dataType: 'string',
                  }),
                }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        counter: { value: 42 },
        items: { value: { items: [] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = (
        (result.reconciledState.values['items'] as NodeValue).value as {
          items: Array<{ values: Record<string, NodeValue> }>;
        }
      ).items;

      expect(items).toHaveLength(1);
      expect(items[0].values['row/counter']).toBeUndefined();
      expect(
        result.diffs.find(
          (diff) => diff.nodeId === 'items' && diff.type === 'migrated'
        )
      ).toBeUndefined();
      expect(result.reconciledState.values['counter']).toEqual({ value: 42 });
    });

    it('emits a migrated diff when cross-level injection occurs', () => {
      const priorView = makeView(
        [
          makeNode({ id: 'tag', type: 'field', key: 'tag', defaultValue: '' }),
          makeNode({
            id: 'items',
            type: 'collection',
            template: makeNode({ id: 'row', type: 'group', children: [] }),
          }),
        ],
        'view-1',
        '1.0'
      );
      const newView = makeView(
        [
          makeNode({
            id: 'items',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({
                  id: 'row_tag',
                  type: 'field',
                  key: 'tag',
                  dataType: 'string',
                }),
              ],
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        tag: { value: 'urgent', isDirty: true },
        items: { value: { items: [] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = (
        (result.reconciledState.values['items'] as NodeValue).value as {
          items: Array<{ values: Record<string, NodeValue> }>;
        }
      ).items;

      expect(items).toHaveLength(1);
      expect(items[0].values['row/row_tag']).toEqual({
        value: undefined,
        suggestion: 'urgent',
        isDirty: true,
      });

      const migrated = result.diffs.filter(
        (d) => d.type === 'migrated' && d.nodeId === 'items'
      );
      expect(migrated).toHaveLength(1);
      expect(result.reconciledState.values['tag']).toBeUndefined();
    });
  });
});
