import { describe, expect, it } from 'vitest';
import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { reconcile } from './reconcile.js';

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
    semanticKey: (overrides as { semanticKey?: string }).semanticKey,
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

function makeTargetCollection(
  collectionId: string,
  fieldId: string,
  semanticKey?: string,
  key?: string,
  minItems?: number
): ViewNode {
  return makeNode({
    id: collectionId,
    type: 'collection',
    ...(minItems !== undefined ? { minItems } : {}),
    template: makeNode({
      id: 'row',
      type: 'group',
      children: [
        makeNode({
          id: fieldId,
          type: 'field',
          dataType: 'string',
          ...(semanticKey ? { semanticKey } : {}),
          ...(key ? { key } : {}),
        }),
        makeNode({
          id: 'title',
          type: 'field',
          dataType: 'string',
          defaultValue: '',
        }),
      ],
    }),
  });
}

function itemsFor(
  result: ReturnType<typeof reconcile>,
  collectionId: string
): Array<{ values: Record<string, NodeValue> }> {
  return (
    result.reconciledState.values[collectionId] as NodeValue<{
      items: Array<{ values: Record<string, NodeValue> }>;
    }>
  ).value.items;
}

describe('cross-level reconciliation', () => {
  describe('category A: semanticKey top-level to collection auto-migration', () => {
    it('moves value into first item when source was removed', () => {
      const priorView = makeView([
        makeNode({
          id: 'user_name',
          type: 'field',
          semanticKey: 'person.name',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'assignee'),
      ]);
      const newView = makeView(
        [
          makeTargetCollection(
            'tasks',
            'assignee',
            'person.name',
            undefined,
            1
          ),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        user_name: { value: 'Alice', isDirty: true },
        tasks: {
          value: { items: [{ values: { 'row/title': { value: 'Task 1' } } }] },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = itemsFor(result, 'tasks');

      expect(items).toHaveLength(1);
      expect(items[0].values['row/assignee']).toEqual({
        value: 'Alice',
        isDirty: true,
      });
      expect(result.reconciledState.values['user_name']).toBeUndefined();
    });

    it('moves value into all existing items', () => {
      const priorView = makeView([
        makeNode({
          id: 'status',
          type: 'field',
          semanticKey: 'item.status',
          dataType: 'string',
        }),
        makeTargetCollection('items', 'state'),
      ]);
      const newView = makeView(
        [makeTargetCollection('items', 'state', 'item.status')],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived', isDirty: true },
        items: {
          value: {
            items: [
              { values: { 'row/title': { value: 'A' } } },
              { values: { 'row/title': { value: 'B' } } },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = itemsFor(result, 'items');
      expect(items).toHaveLength(2);
      expect(items[0].values['row/state']).toEqual({
        value: 'archived',
        isDirty: true,
      });
      expect(items[1].values['row/state']).toEqual({
        value: 'archived',
        isDirty: true,
      });
    });

    it('preserves existing sibling values during migration', () => {
      const priorView = makeView([
        makeNode({
          id: 'owner',
          type: 'field',
          semanticKey: 'task.owner',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'assignee'),
      ]);
      const newView = makeView(
        [makeTargetCollection('tasks', 'assignee', 'task.owner')],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        owner: { value: 'Riley', isDirty: true },
        tasks: {
          value: {
            items: [{ values: { 'row/title': { value: 'Lift' } } }],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const item = itemsFor(result, 'tasks')[0];
      expect(item.values['row/assignee']).toEqual({
        value: 'Riley',
        isDirty: true,
      });
      expect(item.values['row/title']).toEqual({ value: 'Lift' });
    });

    it('fills seeded minItems and migrates into each seeded item', () => {
      const priorView = makeView([
        makeNode({
          id: 'category',
          type: 'field',
          semanticKey: 'task.category',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'kind'),
      ]);
      const newView = makeView(
        [makeTargetCollection('tasks', 'kind', 'task.category', undefined, 2)],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        category: { value: 'Strength' },
        tasks: { value: { items: [] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = itemsFor(result, 'tasks');
      expect(items).toHaveLength(2);
      expect(items[0].values['row/kind']).toEqual({ value: 'Strength' });
      expect(items[1].values['row/kind']).toEqual({ value: 'Strength' });
    });

    it('does not migrate when source still exists at top level', () => {
      const priorView = makeView([
        makeNode({
          id: 'owner',
          type: 'field',
          semanticKey: 'task.owner',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'assignee'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'owner',
            type: 'field',
            semanticKey: 'task.owner',
            dataType: 'string',
          }),
          makeTargetCollection('tasks', 'assignee', 'task.owner'),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        owner: { value: 'Kai', isDirty: true },
        tasks: { value: { items: [{ values: {} }] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const item = itemsFor(result, 'tasks')[0];
      expect(item.values['row/assignee']).toBeUndefined();
      expect(result.reconciledState.values['owner']).toEqual({
        value: 'Kai',
        isDirty: true,
      });
    });

    it('does not migrate when target type differs', () => {
      const priorView = makeView([
        makeNode({
          id: 'owner',
          type: 'field',
          semanticKey: 'task.owner',
          dataType: 'string',
        }),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'tasks',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({
                  id: 'owner',
                  type: 'collection',
                  semanticKey: 'task.owner',
                  template: makeNode({
                    id: 'child',
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
      const priorData = makeData({ owner: { value: 'X' } });

      const result = reconcile(newView, priorView, priorData);
      const item = itemsFor(result, 'tasks')[0];
      expect(item.values['row/owner']).not.toEqual({ value: 'X' });
    });

    for (const [label, value] of [
      ['plain value', { value: 'A' } as NodeValue],
      ['dirty value', { value: 'B', isDirty: true } as NodeValue],
      ['validity metadata', { value: 'C', isValid: false } as NodeValue],
      [
        'with suggestion metadata',
        { value: 'D', suggestion: 'E' } as NodeValue,
      ],
    ] as const) {
      it(`preserves full node value metadata (${label})`, () => {
        const priorView = makeView([
          makeNode({
            id: 'source',
            type: 'field',
            semanticKey: 'meta.key',
            dataType: 'string',
          }),
          makeTargetCollection('tasks', 'target'),
        ]);
        const newView = makeView(
          [makeTargetCollection('tasks', 'target', 'meta.key', undefined, 1)],
          'view-1',
          '2.0'
        );
        const priorData = makeData({
          source: value,
          tasks: { value: { items: [{ values: {} }] } },
        });

        const result = reconcile(newView, priorView, priorData);
        expect(itemsFor(result, 'tasks')[0].values['row/target']).toEqual(
          value
        );
      });
    }

    it('marks collection as migrated in diffs', () => {
      const priorView = makeView([
        makeNode({
          id: 'source',
          type: 'field',
          semanticKey: 'diff.key',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'target'),
      ]);
      const newView = makeView(
        [makeTargetCollection('tasks', 'target', 'diff.key', undefined, 1)],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        source: { value: 'D1' },
        tasks: { value: { items: [] } },
      });

      const result = reconcile(newView, priorView, priorData);
      const migrated = result.diffs.find(
        (d) => d.type === 'migrated' && d.nodeId === 'tasks'
      );
      expect(migrated).toBeDefined();
    });
  });

  describe('category B: semanticKey collection to top-level auto-migration', () => {
    it('extracts first item value when moved to top level', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            semanticKey: 'person.name',
            dataType: 'string',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'row',
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
                  'row/assignee': { value: 'Sam', isDirty: true },
                  'row/title': { value: 'A' },
                },
              },
              {
                values: {
                  'row/assignee': { value: 'Tess' },
                  'row/title': { value: 'B' },
                },
              },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({
        value: 'Sam',
        isDirty: true,
      });
    });

    it('does not extract when source node still exists in collection template', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            semanticKey: 'person.name',
            dataType: 'string',
            defaultValue: '',
          }),
          makeTargetCollection('tasks', 'assignee', 'person.name'),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        tasks: {
          value: {
            items: [
              { values: { 'row/assignee': { value: 'Sam', isDirty: true } } },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({ value: '' });
    });

    for (const itemCount of [0, 1, 2, 3]) {
      it(`handles ${itemCount} collection items deterministically`, () => {
        const priorView = makeView([
          makeTargetCollection('tasks', 'assignee', 'person.name'),
        ]);
        const newView = makeView(
          [
            makeNode({
              id: 'user_name',
              type: 'field',
              semanticKey: 'person.name',
              dataType: 'string',
              defaultValue: '',
            }),
            makeNode({
              id: 'tasks',
              type: 'collection',
              template: makeNode({
                id: 'row',
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
        const items = Array.from({ length: itemCount }, (_, i) => ({
          values: { 'row/assignee': { value: `U${i}` } },
        }));
        const priorData = makeData({
          tasks: { value: { items } },
        });

        const result = reconcile(newView, priorView, priorData);
        const top = result.reconciledState.values['user_name'] as NodeValue;
        if (itemCount === 0) {
          expect(top).toEqual({ value: '' });
        } else {
          expect(top).toEqual({ value: 'U0' });
        }
      });
    }

    it('does not extract when target type differs', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'collection',
            semanticKey: 'person.name',
            template: makeNode({
              id: 'entry',
              type: 'field',
              dataType: 'string',
            }),
          }),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        tasks: {
          value: { items: [{ values: { 'row/assignee': { value: 'Sam' } } }] },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).not.toEqual({
        value: 'Sam',
      });
    });
  });

  describe('category C: regular key top-level to collection suggestion-only', () => {
    it('places source as suggestion and preserves target value', () => {
      const priorView = makeView([
        makeNode({
          id: 'status',
          type: 'field',
          key: 'status',
          dataType: 'string',
        }),
        makeTargetCollection('items', 'item_status'),
      ]);
      const newView = makeView(
        [makeTargetCollection('items', 'item_status', undefined, 'status', 1)],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived', isDirty: true },
        items: {
          value: { items: [{ values: { 'row/title': { value: 'A' } } }] },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const target = itemsFor(result, 'items')[0].values[
        'row/item_status'
      ] as NodeValue;
      expect(target.value).toBeUndefined();
      expect(target.suggestion).toBe('archived');
      expect(target.isDirty).toBe(true);
    });

    it('applies suggestion to all existing items', () => {
      const priorView = makeView([
        makeNode({
          id: 'status',
          type: 'field',
          key: 'status',
          dataType: 'string',
        }),
        makeTargetCollection('items', 'item_status'),
      ]);
      const newView = makeView(
        [makeTargetCollection('items', 'item_status', undefined, 'status')],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived', isDirty: true },
        items: {
          value: {
            items: [
              { values: { 'row/title': { value: 'A' } } },
              { values: { 'row/title': { value: 'B' } } },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      const items = itemsFor(result, 'items');
      expect((items[0].values['row/item_status'] as NodeValue).suggestion).toBe(
        'archived'
      );
      expect((items[1].values['row/item_status'] as NodeValue).suggestion).toBe(
        'archived'
      );
    });

    it('does not suggest when source still exists at top level', () => {
      const priorView = makeView([
        makeNode({
          id: 'status',
          type: 'field',
          key: 'status',
          dataType: 'string',
        }),
        makeTargetCollection('items', 'item_status'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'status',
            type: 'field',
            key: 'status',
            dataType: 'string',
          }),
          makeTargetCollection('items', 'item_status', undefined, 'status'),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived', isDirty: true },
        items: { value: { items: [{ values: {} }] } },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(
        itemsFor(result, 'items')[0].values['row/item_status']
      ).toBeUndefined();
      expect(result.reconciledState.values['status']).toEqual({
        value: 'archived',
        isDirty: true,
      });
    });

    it('does not suggest when types differ', () => {
      const priorView = makeView([
        makeNode({
          id: 'counter',
          type: 'field',
          key: 'counter',
          dataType: 'number',
        }),
      ]);
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
                    id: 'entry',
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
      const priorData = makeData({ counter: { value: 10 } });
      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'items')).toHaveLength(1);
      expect(
        itemsFor(result, 'items')[0].values['row/counter']
      ).toBeUndefined();
      expect(
        result.diffs.find(
          (diff) => diff.nodeId === 'items' && diff.type === 'migrated'
        )
      ).toBeUndefined();
      expect(result.reconciledState.values['counter']).toEqual({ value: 10 });
    });

    for (const initial of ['', 'pending', 'ready', 'done', 'closed']) {
      it(`keeps existing value "${initial}" while adding suggestion`, () => {
        const priorView = makeView([
          makeNode({
            id: 'status',
            type: 'field',
            key: 'status',
            dataType: 'string',
          }),
          makeTargetCollection('items', 'item_status'),
        ]);
        const newView = makeView(
          [makeTargetCollection('items', 'item_status', undefined, 'status')],
          'view-1',
          '2.0'
        );
        const priorData = makeData({
          status: { value: 'archived', isDirty: true },
          items: {
            value: {
              items: [
                {
                  values: {
                    'row/item_status': { value: initial, isDirty: true },
                  },
                },
              ],
            },
          },
        });
        const result = reconcile(newView, priorView, priorData);
        expect(itemsFor(result, 'items')[0].values['row/item_status']).toEqual({
          value: initial,
          isDirty: true,
          suggestion: 'archived',
        });
      });
    }
  });

  describe('category D: regular key collection to top-level suggestion-only', () => {
    it('places first item value into top-level suggestion', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', undefined, 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'person.name',
            dataType: 'string',
            defaultValue: '',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'row',
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
              { values: { 'row/assignee': { value: 'A1', isDirty: true } } },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({
        value: '',
        suggestion: 'A1',
        isDirty: true,
      });
    });

    it('does not suggest when source template field still exists', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', undefined, 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'person.name',
            dataType: 'string',
            defaultValue: '',
          }),
          makeTargetCollection('tasks', 'assignee', undefined, 'person.name'),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        tasks: {
          value: { items: [{ values: { 'row/assignee': { value: 'A1' } } }] },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({ value: '' });
    });

    for (const count of [0, 1, 2, 3, 4]) {
      it(`uses first item only for suggestion with ${count} items`, () => {
        const priorView = makeView([
          makeTargetCollection('tasks', 'assignee', undefined, 'person.name'),
        ]);
        const newView = makeView(
          [
            makeNode({
              id: 'user_name',
              type: 'field',
              key: 'person.name',
              dataType: 'string',
              defaultValue: '',
            }),
            makeNode({
              id: 'tasks',
              type: 'collection',
              template: makeNode({
                id: 'row',
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
        const items = Array.from({ length: count }, (_, i) => ({
          values: { 'row/assignee': { value: `N${i}` } },
        }));
        const priorData = makeData({ tasks: { value: { items } } });

        const result = reconcile(newView, priorView, priorData);
        const top = result.reconciledState.values['user_name'] as NodeValue;
        if (count === 0) {
          expect(top).toEqual({ value: '' });
        } else {
          expect(top).toEqual({ value: '', suggestion: `N0` });
        }
      });
    }
  });

  describe('category E: removal gate behavior', () => {
    const cases = [
      { mode: 'semantic', sourceStays: true, expectApplied: false },
      { mode: 'semantic', sourceStays: false, expectApplied: true },
      { mode: 'key', sourceStays: true, expectApplied: false },
      { mode: 'key', sourceStays: false, expectApplied: true },
    ] as const;

    for (const t of cases) {
      it(`mode=${t.mode} sourceStays=${t.sourceStays}`, () => {
        const source = makeNode({
          id: 'source',
          type: 'field',
          dataType: 'string',
          ...(t.mode === 'semantic'
            ? { semanticKey: 'gate.key' }
            : { key: 'gate.key' }),
        });
        const priorView = makeView([
          source,
          makeTargetCollection('tasks', 'target'),
        ]);
        const target = makeTargetCollection(
          'tasks',
          'target',
          t.mode === 'semantic' ? 'gate.key' : undefined,
          t.mode === 'key' ? 'gate.key' : undefined,
          1
        );
        const newNodes: ViewNode[] = [];
        if (t.sourceStays) {
          newNodes.push(source);
        }
        newNodes.push(target);
        const newView = makeView(newNodes, 'view-1', '2.0');
        const priorData = makeData({
          source: { value: 'S' },
          tasks: { value: { items: [{ values: {} }] } },
        });

        const result = reconcile(newView, priorView, priorData);
        const itemValue = itemsFor(result, 'tasks')[0].values['row/target'] as
          | NodeValue
          | undefined;
        if (!t.expectApplied) {
          expect(itemValue).toBeUndefined();
        } else if (t.mode === 'semantic') {
          expect(itemValue).toEqual({ value: 'S' });
        } else {
          expect(itemValue).toEqual({ value: undefined, suggestion: 'S' });
        }
      });
    }

    it('counts same-level type replacement as removed for cross-level matching', () => {
      const priorView = makeView([
        makeNode({
          id: 'source',
          type: 'field',
          semanticKey: 'replace.key',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'target'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'source',
            type: 'action',
            semanticKey: 'replace.key',
            intentId: 'x',
            label: 'x',
          }),
          makeTargetCollection('tasks', 'target', 'replace.key', undefined, 1),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        source: { value: 'Z' },
        tasks: { value: { items: [{ values: {} }] } },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'tasks')[0].values['row/target']).toEqual({
        value: 'Z',
      });
    });

    it('does not treat same-level rename without key as cross-level migration', () => {
      const priorView = makeView([
        makeNode({ id: 'source', type: 'field', dataType: 'string' }),
        makeTargetCollection('tasks', 'target'),
      ]);
      const newView = makeView(
        [
          makeNode({ id: 'source_new', type: 'field', dataType: 'string' }),
          makeTargetCollection('tasks', 'target', 'source'),
        ],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        source: { value: 'Z' },
        tasks: { value: { items: [{ values: {} }] } },
      });
      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'tasks')[0].values['row/target']).toBeUndefined();
    });
  });

  describe('category F: user data protection invariants', () => {
    it('regular key never overwrites dirty item value', () => {
      const priorView = makeView([
        makeNode({
          id: 'status',
          type: 'field',
          key: 'status',
          dataType: 'string',
        }),
        makeTargetCollection('items', 'item_status'),
      ]);
      const newView = makeView(
        [makeTargetCollection('items', 'item_status', undefined, 'status')],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        status: { value: 'archived' },
        items: {
          value: {
            items: [
              {
                values: {
                  'row/item_status': { value: 'active', isDirty: true },
                },
              },
            ],
          },
        },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'items')[0].values['row/item_status']).toEqual({
        value: 'active',
        isDirty: true,
        suggestion: 'archived',
      });
    });

    it('regular key never overwrites dirty top-level value on collection-to-top', () => {
      const priorView = makeView([
        makeTargetCollection('tasks', 'assignee', undefined, 'person.name'),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'user_name',
            type: 'field',
            key: 'person.name',
            dataType: 'string',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'row',
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
            items: [{ values: { 'row/assignee': { value: 'Taylor' } } }],
          },
        },
        user_name: { value: 'Jordan', isDirty: true },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(result.reconciledState.values['user_name']).toEqual({
        value: 'Jordan',
        isDirty: true,
        suggestion: 'Taylor',
      });
    });

    it('semanticKey migration preserves dirty metadata', () => {
      const priorView = makeView([
        makeNode({
          id: 'source',
          type: 'field',
          semanticKey: 'dirty.key',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'target'),
      ]);
      const newView = makeView(
        [makeTargetCollection('tasks', 'target', 'dirty.key', undefined, 1)],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        source: { value: 'D', isDirty: true, isValid: false },
        tasks: { value: { items: [{ values: {} }] } },
      });

      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'tasks')[0].values['row/target']).toEqual({
        value: 'D',
        isDirty: true,
        isValid: false,
      });
    });

    for (const value of ['A', 'B', 'C', 'D', 'E', 'F']) {
      it(`round-trip semanticKey preserves latest user edit (${value})`, () => {
        const v1 = makeView(
          [
            makeNode({
              id: 'name',
              type: 'field',
              semanticKey: 'person.name',
              dataType: 'string',
            }),
            makeTargetCollection('tasks', 'assignee'),
          ],
          'view-1',
          '1.0'
        );
        const v2 = makeView(
          [
            makeTargetCollection(
              'tasks',
              'assignee',
              'person.name',
              undefined,
              1
            ),
          ],
          'view-1',
          '2.0'
        );
        const v3 = makeView(
          [
            makeNode({
              id: 'name',
              type: 'field',
              semanticKey: 'person.name',
              dataType: 'string',
            }),
            makeNode({
              id: 'tasks',
              type: 'collection',
              template: makeNode({
                id: 'row',
                type: 'group',
                children: [
                  makeNode({ id: 'title', type: 'field', dataType: 'string' }),
                ],
              }),
            }),
          ],
          'view-1',
          '3.0'
        );

        const r2 = reconcile(
          v2,
          v1,
          makeData({
            name: { value, isDirty: true },
            tasks: { value: { items: [{ values: {} }] } },
          })
        );
        const tasksAfter = itemsFor(r2, 'tasks');
        tasksAfter[0].values['row/assignee'] = {
          value: `${value}-edited`,
          isDirty: true,
        };
        const priorForV3 = makeData({
          tasks: { value: { items: tasksAfter } },
        });
        const r3 = reconcile(v3, v2, priorForV3);
        expect(r3.reconciledState.values['name']).toEqual({
          value: `${value}-edited`,
          isDirty: true,
        });
      });
    }
  });

  describe('category G: multi-step scenarios', () => {
    it('regular key round-trip remains suggestion-only in both directions', () => {
      const v1 = makeView(
        [
          makeNode({
            id: 'name',
            type: 'field',
            key: 'person.name',
            dataType: 'string',
          }),
          makeTargetCollection('tasks', 'assignee'),
        ],
        'view-1',
        '1.0'
      );
      const v2 = makeView(
        [
          makeTargetCollection(
            'tasks',
            'assignee',
            undefined,
            'person.name',
            1
          ),
        ],
        'view-1',
        '2.0'
      );
      const r2 = reconcile(
        v2,
        v1,
        makeData({
          name: { value: 'Alpha', isDirty: true },
          tasks: { value: { items: [{ values: {} }] } },
        })
      );
      expect(itemsFor(r2, 'tasks')[0].values['row/assignee']).toEqual({
        value: undefined,
        suggestion: 'Alpha',
        isDirty: true,
      });

      const v3 = makeView(
        [
          makeNode({
            id: 'name',
            type: 'field',
            key: 'person.name',
            dataType: 'string',
            defaultValue: '',
          }),
          makeNode({
            id: 'tasks',
            type: 'collection',
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({ id: 'title', type: 'field', dataType: 'string' }),
              ],
            }),
          }),
        ],
        'view-1',
        '3.0'
      );
      const r3 = reconcile(
        v3,
        v2,
        makeData({
          tasks: r2.reconciledState.values['tasks'] as NodeValue,
        })
      );
      expect(r3.reconciledState.values['name']).toEqual({
        value: '',
        suggestion: undefined,
      });
    });

    it('semanticKey takes precedence over key when both are present', () => {
      const priorView = makeView([
        makeNode({
          id: 'source',
          type: 'field',
          key: 'k1',
          semanticKey: 's1',
          dataType: 'string',
        }),
      ]);
      const newView = makeView(
        [
          makeNode({
            id: 'tasks',
            type: 'collection',
            minItems: 1,
            template: makeNode({
              id: 'row',
              type: 'group',
              children: [
                makeNode({
                  id: 'target',
                  type: 'field',
                  key: 'k1',
                  semanticKey: 's1',
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
        source: { value: 'X', isDirty: true },
      });
      const result = reconcile(newView, priorView, priorData);
      expect(itemsFor(result, 'tasks')[0].values['row/target']).toEqual({
        value: 'X',
        isDirty: true,
      });
    });

    for (const push of [1, 2, 3, 4, 5, 6, 7]) {
      it(`preserves determinism through repeated multi-push chain ${push}`, () => {
        const v1 = makeView(
          [
            makeNode({
              id: 'name',
              type: 'field',
              semanticKey: 'person.name',
              dataType: 'string',
            }),
            makeTargetCollection('tasks', 'assignee'),
          ],
          'view-1',
          '1.0'
        );
        const v2 = makeView(
          [
            makeTargetCollection(
              'tasks',
              'assignee',
              'person.name',
              undefined,
              1
            ),
          ],
          'view-1',
          '2.0'
        );
        const v3 = makeView(
          [
            makeNode({
              id: 'name',
              type: 'field',
              semanticKey: 'person.name',
              dataType: 'string',
            }),
            makeNode({
              id: 'tasks',
              type: 'collection',
              template: makeNode({
                id: 'row',
                type: 'group',
                children: [
                  makeNode({ id: 'title', type: 'field', dataType: 'string' }),
                ],
              }),
            }),
          ],
          'view-1',
          '3.0'
        );
        const d1 = makeData({
          name: { value: `N${push}`, isDirty: true },
          tasks: { value: { items: [{ values: {} }] } },
        });
        const clock = () => 123456789;
        const d2 = reconcile(v2, v1, d1, { clock });
        const d3a = reconcile(
          v3,
          v2,
          makeData({ tasks: d2.reconciledState.values['tasks'] as NodeValue }),
          { clock }
        );
        const d3b = reconcile(
          v3,
          v2,
          makeData({ tasks: d2.reconciledState.values['tasks'] as NodeValue }),
          { clock }
        );
        expect(d3a).toEqual(d3b);
      });
    }
  });

  describe('category H: edge cases', () => {
    for (const key of [
      '',
      ' ',
      'x',
      'very.long.semantic.key.path.1',
      'very.long.semantic.key.path.2',
    ]) {
      it(`handles semanticKey "${key}"`, () => {
        const priorView = makeView([
          makeNode({
            id: 'source',
            type: 'field',
            semanticKey: key || undefined,
            dataType: 'string',
          }),
          makeTargetCollection('tasks', 'target'),
        ]);
        const newView = makeView(
          [
            makeTargetCollection(
              'tasks',
              'target',
              key || undefined,
              undefined,
              1
            ),
          ],
          'view-1',
          '2.0'
        );
        const priorData = makeData({
          source: { value: 'V' },
          tasks: { value: { items: [{ values: {} }] } },
        });
        const result = reconcile(newView, priorView, priorData);
        if (key.length === 0) {
          expect(
            itemsFor(result, 'tasks')[0].values['row/target']
          ).toBeUndefined();
        } else {
          expect(itemsFor(result, 'tasks')[0].values['row/target']).toEqual({
            value: 'V',
          });
        }
      });
    }

    it('does not run cross-level migration when priorView is null', () => {
      const view = makeView([
        makeTargetCollection('tasks', 'target', 'x', undefined, 1),
      ]);
      const priorData = makeData({
        source: { value: 'A' },
      });
      const result = reconcile(view, null, priorData);
      expect(result.reconciledState.values['tasks']).toBeUndefined();
    });
  });

  describe('category I: determinism', () => {
    it('produces identical output for identical inputs across 10 runs', () => {
      const priorView = makeView([
        makeNode({
          id: 'source',
          type: 'field',
          semanticKey: 'det.key',
          dataType: 'string',
        }),
        makeTargetCollection('tasks', 'target'),
      ]);
      const newView = makeView(
        [makeTargetCollection('tasks', 'target', 'det.key', undefined, 2)],
        'view-1',
        '2.0'
      );
      const priorData = makeData({
        source: { value: 'D', isDirty: true },
        tasks: { value: { items: [{ values: {} }] } },
      });

      const clock = () => 987654321;
      const outputs = Array.from({ length: 10 }, () =>
        reconcile(newView, priorView, priorData, { clock })
      );
      for (let i = 1; i < outputs.length; i += 1) {
        expect(outputs[i]).toEqual(outputs[0]);
      }
    });

    for (const ordering of [0, 1, 2, 3, 4, 5]) {
      it(`node ordering variant ${ordering} does not change result`, () => {
        const source = makeNode({
          id: 'source',
          type: 'field',
          semanticKey: 'ord.key',
          dataType: 'string',
        });
        const coll = makeTargetCollection(
          'tasks',
          'target',
          'ord.key',
          undefined,
          1
        );
        const nodes = ordering % 2 === 0 ? [source, coll] : [coll, source];
        const priorView = makeView(nodes);
        const newView = makeView([coll], 'view-1', '2.0');
        const priorData = makeData({
          source: { value: 'O' },
          tasks: { value: { items: [{ values: {} }] } },
        });
        const r1 = reconcile(newView, priorView, priorData);
        const r2 = reconcile(newView, priorView, priorData);
        expect(r1).toEqual(r2);
      });
    }
  });
});
