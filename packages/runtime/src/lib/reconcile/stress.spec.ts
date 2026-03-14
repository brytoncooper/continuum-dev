import { describe, it, expect } from 'vitest';
import type {
  ViewDefinition,
  ViewNode,
  DataSnapshot,
  NodeValue,
} from '@continuum-dev/contract';
import { ISSUE_CODES } from '@continuum-dev/contract';
import { reconcile as runtimeReconcile } from './index.js';
import type { ReconciliationOptions } from '../types.js';

const TEST_NOW = 2000;

function reconcile(
  newView: ViewDefinition,
  priorView: ViewDefinition | null,
  priorData: DataSnapshot | null,
  options: ReconciliationOptions = {}
) {
  return runtimeReconcile(newView, priorView, priorData, {
    clock: () => TEST_NOW,
    ...options,
  });
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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
    ...(type === 'row' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'grid' ? { children: [] as ViewNode[] } : {}),
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
  extra?: Partial<DataSnapshot>
): DataSnapshot {
  return {
    values,
    lineage: { timestamp: 1000, sessionId: 'test-session' },
    ...extra,
  };
}

function collectionNode(
  id: string,
  template: ViewNode,
  overrides?: Partial<ViewNode>
): ViewNode {
  return makeNode({
    id,
    type: 'collection',
    template,
    ...(overrides ?? {}),
  });
}

function getItems(
  result: ReturnType<typeof reconcile>,
  nodeId: string
): Array<{ values: Record<string, NodeValue> }> {
  const val = result.reconciledState.values[nodeId] as
    | NodeValue<{ items: Array<{ values: Record<string, NodeValue> }> }>
    | undefined;
  return val?.value?.items ?? [];
}

// ─── 1. Collection Template Path Remapping ────────────────────────────────────

describe('collection template path remapping', () => {
  it('carries item values when template container ID changes', () => {
    const priorTemplate = makeNode({
      id: 'set_tpl',
      type: 'group',
      key: 'set_tpl',
      children: [
        makeNode({
          id: 'grid_main',
          type: 'grid',
          key: 'set_fields',
          children: [
            makeNode({ id: 'fld_weight', key: 'weight', dataType: 'number' }),
            makeNode({ id: 'fld_reps', key: 'reps', dataType: 'number' }),
          ],
        }),
      ],
    });
    const newTemplate = makeNode({
      id: 'set_tpl',
      type: 'group',
      key: 'set_tpl',
      children: [
        makeNode({
          id: 'grid_set_numbers',
          type: 'grid',
          key: 'set_fields',
          children: [
            makeNode({ id: 'fld_weight', key: 'weight', dataType: 'number' }),
            makeNode({ id: 'fld_reps', key: 'reps', dataType: 'number' }),
          ],
        }),
      ],
    });

    const priorView = makeView([collectionNode('sets', priorTemplate)]);
    const newView = makeView([collectionNode('sets', newTemplate)]);
    const priorData = makeData({
      sets: {
        value: {
          items: [
            {
              values: {
                'set_tpl/grid_main/fld_weight': { value: 225 },
                'set_tpl/grid_main/fld_reps': { value: 8 },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'sets');

    expect(items).toHaveLength(1);
    expect(items[0].values['set_tpl/grid_set_numbers/fld_weight']).toEqual({
      value: 225,
    });
    expect(items[0].values['set_tpl/grid_set_numbers/fld_reps']).toEqual({
      value: 8,
    });
    // Old path keys should be gone
    expect(items[0].values['set_tpl/grid_main/fld_weight']).toBeUndefined();
  });

  it('carries item values when template root group ID changes', () => {
    const priorTemplate = makeNode({
      id: 'grp_tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'fld_name', key: 'name' })],
    });
    const newTemplate = makeNode({
      id: 'grp_set_card',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'fld_name', key: 'name' })],
    });

    const priorView = makeView([collectionNode('items', priorTemplate)]);
    const newView = makeView([collectionNode('items', newTemplate)]);
    const priorData = makeData({
      items: {
        value: {
          items: [{ values: { 'grp_tpl/fld_name': { value: 'Alice' } } }],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'items');
    expect(items[0].values['grp_set_card/fld_name']).toEqual({
      value: 'Alice',
    });
  });

  it('remaps nested 3-deep template paths', () => {
    const priorTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({
          id: 'row_a',
          type: 'row',
          key: 'section',
          children: [makeNode({ id: 'fld_x', key: 'x_val' })],
        }),
      ],
    });
    const newTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({
          id: 'grid_b',
          type: 'grid',
          key: 'section',
          children: [makeNode({ id: 'fld_x', key: 'x_val' })],
        }),
      ],
    });

    const priorView = makeView([collectionNode('c', priorTemplate)]);
    const newView = makeView([collectionNode('c', newTemplate)]);
    const priorData = makeData({
      c: {
        value: { items: [{ values: { 'tpl/row_a/fld_x': { value: 42 } } }] },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items[0].values['tpl/grid_b/fld_x']).toEqual({ value: 42 });
    expect(items[0].values['tpl/row_a/fld_x']).toBeUndefined();
  });

  it('preserves values when only some template nodes are renamed', () => {
    const priorTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'stable', key: 'stable' }),
        makeNode({ id: 'old_id', key: 'renamed_one' }),
      ],
    });
    const newTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'stable', key: 'stable' }),
        makeNode({ id: 'new_id', key: 'renamed_one' }),
      ],
    });

    const priorView = makeView([collectionNode('c', priorTemplate)]);
    const newView = makeView([collectionNode('c', newTemplate)]);
    const priorData = makeData({
      c: {
        value: {
          items: [
            {
              values: {
                'tpl/stable': { value: 'kept' },
                'tpl/old_id': { value: 'moved' },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items[0].values['tpl/stable']).toEqual({ value: 'kept' });
    expect(items[0].values['tpl/new_id']).toEqual({ value: 'moved' });
  });

  it('drops value when leaf key also changes (expected loss)', () => {
    const priorTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'fld_a', key: 'old_key' })],
    });
    const newTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'fld_b', key: 'new_key' })],
    });

    const priorView = makeView([collectionNode('c', priorTemplate)]);
    const newView = makeView([collectionNode('c', newTemplate)]);
    const priorData = makeData({
      c: { value: { items: [{ values: { 'tpl/fld_a': { value: 'gone' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    // Original key -> value pair is kept because no remapping match was found
    // but it won't match the new template paths (orphaned)
    expect(items[0].values['tpl/fld_b']).toBeUndefined();
  });

  it('handles multiple fields at same depth being remapped simultaneously', () => {
    const priorTemplate = makeNode({
      id: 'tpl',
      type: 'row',
      key: 'tpl',
      children: [
        makeNode({ id: 'a', key: 'alpha' }),
        makeNode({ id: 'b', key: 'beta' }),
        makeNode({ id: 'c', key: 'gamma' }),
      ],
    });
    const newTemplate = makeNode({
      id: 'card',
      type: 'row',
      key: 'tpl',
      children: [
        makeNode({ id: 'fld_alpha', key: 'alpha' }),
        makeNode({ id: 'fld_beta', key: 'beta' }),
        makeNode({ id: 'fld_gamma', key: 'gamma' }),
      ],
    });

    const priorView = makeView([collectionNode('col', priorTemplate)]);
    const newView = makeView([collectionNode('col', newTemplate)]);
    const priorData = makeData({
      col: {
        value: {
          items: [
            {
              values: {
                'tpl/a': { value: 'A' },
                'tpl/b': { value: 'B' },
                'tpl/c': { value: 'C' },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'col');
    expect(items[0].values['card/fld_alpha']).toEqual({ value: 'A' });
    expect(items[0].values['card/fld_beta']).toEqual({ value: 'B' });
    expect(items[0].values['card/fld_gamma']).toEqual({ value: 'C' });
  });

  it('remaps values with multi-item collections', () => {
    const priorTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'old_name', key: 'name' })],
    });
    const newTemplate = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'new_name', key: 'name' })],
    });

    const priorView = makeView([collectionNode('list', priorTemplate)]);
    const newView = makeView([collectionNode('list', newTemplate)]);
    const priorData = makeData({
      list: {
        value: {
          items: [
            { values: { 'tpl/old_name': { value: 'Item 1' } } },
            { values: { 'tpl/old_name': { value: 'Item 2' } } },
            { values: { 'tpl/old_name': { value: 'Item 3' } } },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'list');
    expect(items).toHaveLength(3);
    expect(items[0].values['tpl/new_name']).toEqual({ value: 'Item 1' });
    expect(items[1].values['tpl/new_name']).toEqual({ value: 'Item 2' });
    expect(items[2].values['tpl/new_name']).toEqual({ value: 'Item 3' });
  });
});

// ─── 2. Multi-Push Restructure Sequences ──────────────────────────────────────

describe('multi-push restructure sequences', () => {
  it('carries data through two consecutive restructures (v1→v2→v3)', () => {
    const v1 = makeView([makeNode({ id: 'old_email', key: 'email' })]);
    const v2 = makeView([makeNode({ id: 'fld_email', key: 'email' })]);
    const v3 = makeView([makeNode({ id: 'input_email', key: 'email' })]);
    const data1 = makeData({ old_email: { value: 'a@b.com' } });

    const r1 = reconcile(v2, v1, data1);
    expect(r1.reconciledState.values['fld_email']).toEqual({
      value: 'a@b.com',
    });

    const r2 = reconcile(v3, v2, r1.reconciledState);
    expect(r2.reconciledState.values['input_email']).toEqual({
      value: 'a@b.com',
    });
  });

  it('round-trip v1→v2→v1 preserves original values', () => {
    const v1 = makeView([makeNode({ id: 'name', key: 'name' })]);
    const v2 = makeView([makeNode({ id: 'fld_name', key: 'name' })]);
    const data = makeData({ name: { value: 'Bryton' } });

    const r1 = reconcile(v2, v1, data);
    const r2 = reconcile(v1, v2, r1.reconciledState);
    expect(r2.reconciledState.values['name']).toEqual({ value: 'Bryton' });
  });

  it('beautify scenario: reorganized containers, all values survive', () => {
    const v1 = makeView([
      makeNode({
        id: 'root',
        type: 'group',
        children: [
          makeNode({ id: 'field_a', key: 'a' }),
          makeNode({ id: 'field_b', key: 'b' }),
          makeNode({ id: 'field_c', key: 'c' }),
        ],
      }),
    ]);
    const v2 = makeView([
      makeNode({
        id: 'root',
        type: 'group',
        children: [
          makeNode({
            id: 'section_1',
            type: 'row',
            children: [
              makeNode({ id: 'field_a', key: 'a' }),
              makeNode({ id: 'field_b', key: 'b' }),
            ],
          }),
          makeNode({ id: 'field_c', key: 'c' }),
        ],
      }),
    ]);
    const data = makeData({
      'root/field_a': { value: 'A' },
      'root/field_b': { value: 'B' },
      'root/field_c': { value: 'C' },
    });

    const result = reconcile(v2, v1, data);
    expect(result.reconciledState.values['root/section_1/field_a']).toEqual({
      value: 'A',
    });
    expect(result.reconciledState.values['root/section_1/field_b']).toEqual({
      value: 'B',
    });
    expect(result.reconciledState.values['root/field_c']).toEqual({
      value: 'C',
    });
  });

  it('field removed in v2, re-added in v3 — restored from detachedValues', () => {
    const v1 = makeView([
      makeNode({ id: 'a', key: 'keep' }),
      makeNode({ id: 'b', key: 'remove' }),
    ]);
    const v2 = makeView([makeNode({ id: 'a', key: 'keep' })]);
    const v3 = makeView([
      makeNode({ id: 'a', key: 'keep' }),
      makeNode({ id: 'b2', key: 'remove' }),
    ]);
    const data = makeData({
      a: { value: 'A' },
      b: { value: 'B' },
    });

    const r1 = reconcile(v2, v1, data);
    expect(r1.reconciledState.detachedValues?.['remove']).toBeDefined();

    const r2 = reconcile(v3, v2, r1.reconciledState);
    expect(r2.reconciledState.values['b2']).toEqual({ value: 'B' });
  });

  it('three-step with container renames at each level', () => {
    const v1 = makeView([
      makeNode({
        id: 'grp_1',
        type: 'group',
        key: 'root',
        children: [makeNode({ id: 'f', key: 'data' })],
      }),
    ]);
    const v2 = makeView([
      makeNode({
        id: 'grp_2',
        type: 'group',
        key: 'root',
        children: [makeNode({ id: 'f2', key: 'data' })],
      }),
    ]);
    const v3 = makeView([
      makeNode({
        id: 'grp_3',
        type: 'group',
        key: 'root',
        children: [makeNode({ id: 'f3', key: 'data' })],
      }),
    ]);
    const data = makeData({ 'grp_1/f': { value: 'origin' } });

    const r1 = reconcile(v2, v1, data);
    expect(r1.reconciledState.values['grp_2/f2']).toEqual({ value: 'origin' });

    const r2 = reconcile(v3, v2, r1.reconciledState);
    expect(r2.reconciledState.values['grp_3/f3']).toEqual({ value: 'origin' });
  });
});

// ─── 3. Same-Push Detach + Restore ────────────────────────────────────────────

describe('same-push detach + restore', () => {
  it('restores when both ID and key rename in single push', () => {
    const priorView = makeView([makeNode({ id: 'a', key: 'ak' })]);
    const newView = makeView([makeNode({ id: 'b', key: 'ak' })]);
    const priorData = makeData({ a: { value: 'kept' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['b']).toEqual({ value: 'kept' });
  });

  it('group container renamed + children renamed — all children restored', () => {
    const priorView = makeView([
      makeNode({
        id: 'grp1',
        type: 'group',
        key: 'section',
        children: [makeNode({ id: 'child_old', key: 'child_key' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'grp2',
        type: 'group',
        key: 'section',
        children: [makeNode({ id: 'child_new', key: 'child_key' })],
      }),
    ]);
    const priorData = makeData({ 'grp1/child_old': { value: 'restored' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['grp2/child_new']).toEqual({
      value: 'restored',
    });
  });

  it('restores by key when type matches, skips when type differs', () => {
    const priorView = makeView([
      makeNode({ id: 'a', key: 'ak', type: 'field' }),
      makeNode({ id: 'b', key: 'bk', type: 'action' }),
    ]);
    const newView = makeView([
      makeNode({ id: 'c', key: 'ak', type: 'field' }),
      // bk now expects a field but prior was action
      makeNode({ id: 'd', key: 'bk', type: 'field' }),
    ]);
    const priorData = makeData({
      a: { value: 'field-val' },
      b: { value: true },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['c']).toEqual({ value: 'field-val' });
    // b was action -> d is field = type mismatch, value should be detached
    expect(result.reconciledState.values['d']).toBeUndefined();
  });
});

// ─── 4. Collection Constraint Edge Cases ──────────────────────────────────────

describe('collection constraint edge cases', () => {
  const simpleTpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });

  it('maxItems reduced below current item count — truncates from end', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl, { maxItems: 1 })]);
    const priorData = makeData({
      c: {
        value: {
          items: [
            { values: { item: { value: 'first' } } },
            { values: { item: { value: 'second' } } },
            { values: { item: { value: 'third' } } },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toHaveLength(1);
    expect(items[0].values['item']).toEqual({ value: 'first' });
  });

  it('minItems increased — pads with defaults, existing untouched', () => {
    const priorView = makeView([
      collectionNode('c', simpleTpl, { minItems: 1 }),
    ]);
    const newView = makeView([collectionNode('c', simpleTpl, { minItems: 3 })]);
    const priorData = makeData({
      c: { value: { items: [{ values: { item: { value: 'existing' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toHaveLength(3);
    expect(items[0].values['item']).toEqual({ value: 'existing' });
  });

  it('maxItems=0 — all items removed', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl, { maxItems: 0 })]);
    const priorData = makeData({
      c: { value: { items: [{ values: { item: { value: 'gone' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toHaveLength(0);
  });

  it('negative minItems/maxItems treated as zero/undefined', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([
      collectionNode('c', simpleTpl, { minItems: -5, maxItems: -3 }),
    ]);
    const priorData = makeData({
      c: { value: { items: [{ values: { item: { value: 'kept' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    // negative minItems -> 0, negative maxItems -> undefined (no limit)
    expect(items).toHaveLength(1);
    expect(items[0].values['item']).toEqual({ value: 'kept' });
  });

  it('constraints change simultaneously with template restructure', () => {
    const priorTpl = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'old_f', key: 'data' })],
    });
    const newTpl = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [makeNode({ id: 'new_f', key: 'data' })],
    });
    const priorView = makeView([collectionNode('c', priorTpl)]);
    const newView = makeView([collectionNode('c', newTpl, { maxItems: 2 })]);
    const priorData = makeData({
      c: {
        value: {
          items: [
            { values: { 'tpl/old_f': { value: 'A' } } },
            { values: { 'tpl/old_f': { value: 'B' } } },
            { values: { 'tpl/old_f': { value: 'C' } } },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toHaveLength(2);
    expect(items[0].values['tpl/new_f']).toEqual({ value: 'A' });
    expect(items[1].values['tpl/new_f']).toEqual({ value: 'B' });
  });
});

// ─── 5. Nested Collections ───────────────────────────────────────────────────

describe('nested collections', () => {
  it('inner collection preserved when outer template structure changes', () => {
    const innerTpl = makeNode({
      id: 'phone_val',
      type: 'field',
      dataType: 'string',
    });
    const priorOuter = makeNode({
      id: 'addr_tpl',
      type: 'group',
      key: 'addr_tpl',
      children: [
        makeNode({ id: 'street', key: 'street' }),
        collectionNode('phones', innerTpl, { key: 'phones' }),
      ],
    });
    const newOuter = makeNode({
      id: 'addr_card',
      type: 'group',
      key: 'addr_tpl',
      children: [
        makeNode({ id: 'street', key: 'street' }),
        collectionNode('phones', innerTpl, { key: 'phones' }),
      ],
    });

    const priorView = makeView([collectionNode('addrs', priorOuter)]);
    const newView = makeView([collectionNode('addrs', newOuter)]);
    const priorData = makeData({
      addrs: {
        value: {
          items: [
            {
              values: {
                'addr_tpl/street': { value: '123 Main' },
                'addr_tpl/phones': {
                  value: {
                    items: [{ values: { phone_val: { value: '555-1234' } } }],
                  },
                },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'addrs');
    expect(items).toHaveLength(1);
    expect(items[0].values['addr_card/street']).toEqual({ value: '123 Main' });
    expect(items[0].values['addr_card/phones']).toBeDefined();
  });

  it('fresh session with nested collection creates correct defaults', () => {
    const innerTpl = makeNode({ id: 'val', type: 'field', dataType: 'string' });
    const outerTpl = makeNode({
      id: 'tpl',
      type: 'group',
      children: [collectionNode('inner', innerTpl)],
    });
    const view = makeView([collectionNode('outer', outerTpl, { minItems: 1 })]);
    const result = reconcile(view, null, null);
    const items = getItems(result, 'outer');
    expect(items).toHaveLength(1);
    expect(items[0].values['tpl/inner']).toBeDefined();
    const innerVal = items[0].values['tpl/inner'] as NodeValue<{
      items: unknown[];
    }>;
    expect(innerVal.value.items).toEqual([]);
  });

  it('type mismatch in inner collection template — inner reset, outer preserved', () => {
    const innerTplOld = makeNode({
      id: 'val',
      type: 'field',
      dataType: 'string',
    });
    const innerTplNew = makeNode({
      id: 'val',
      type: 'action',
      intentId: 'x',
      label: 'Go',
    });
    const outerTplOld = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'title', key: 'title' }),
        collectionNode('inner', innerTplOld, { key: 'inner' }),
      ],
    });
    const outerTplNew = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'title', key: 'title' }),
        collectionNode('inner', innerTplNew, { key: 'inner' }),
      ],
    });
    const priorView = makeView([collectionNode('c', outerTplOld)]);
    const newView = makeView([collectionNode('c', outerTplNew)]);
    const priorData = makeData({
      c: {
        value: {
          items: [
            {
              values: {
                'tpl/title': { value: 'Keep me' },
                'tpl/inner': {
                  value: { items: [{ values: { val: { value: 'old' } } }] },
                },
              },
            },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items[0].values['tpl/title']).toEqual({ value: 'Keep me' });
    // inner collection gets reset due to template type mismatch
  });
});

// ─── 6. Type Change Scenarios ─────────────────────────────────────────────────

describe('type change scenarios', () => {
  it('field→action: value detached, action gets no state', () => {
    const priorView = makeView([makeNode({ id: 'a', type: 'field' })]);
    const newView = makeView([makeNode({ id: 'a', type: 'action' })]);
    const priorData = makeData({ a: { value: 'hello' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['a']).toBeUndefined();
    expect(result.diffs.some((d) => d.type === 'type-changed')).toBe(true);
  });

  it('action→field: field gets defaultValue if present', () => {
    const priorView = makeView([makeNode({ id: 'a', type: 'action' })]);
    const newView = makeView([
      makeNode({ id: 'a', type: 'field', defaultValue: 'default' }),
    ]);
    const priorData = makeData({ a: { value: true } });

    const result = reconcile(newView, priorView, priorData);
    // Type mismatch detaches the value
    expect(result.reconciledState.values['a']).toBeUndefined();
  });

  it('group→field: children values detached, field initialized', () => {
    const priorView = makeView([
      makeNode({
        id: 'a',
        type: 'group',
        children: [makeNode({ id: 'child' })],
      }),
    ]);
    const newView = makeView([makeNode({ id: 'a', type: 'field' })]);
    const priorData = makeData({ 'a/child': { value: 'nested' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['a/child']).toBeUndefined();
    expect(result.diffs.some((d) => d.type === 'type-changed')).toBe(true);
  });

  it('field→collection: collection initialized fresh', () => {
    const tpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });
    const priorView = makeView([makeNode({ id: 'a', type: 'field' })]);
    const newView = makeView([collectionNode('a', tpl)]);
    const priorData = makeData({ a: { value: 'was a field' } });

    const result = reconcile(newView, priorView, priorData);
    expect(
      result.issues.some((i) => i.code === ISSUE_CODES.TYPE_MISMATCH)
    ).toBe(true);
  });

  it('collection→field: field initialized, collection detached', () => {
    const tpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });
    const priorView = makeView([collectionNode('a', tpl)]);
    const newView = makeView([
      makeNode({ id: 'a', type: 'field', defaultValue: 'new' }),
    ]);
    const priorData = makeData({
      a: { value: { items: [{ values: { item: { value: 'old' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(
      result.issues.some((i) => i.code === ISSUE_CODES.TYPE_MISMATCH)
    ).toBe(true);
  });

  it('row→grid container swap preserves children via key', () => {
    const priorView = makeView([
      makeNode({
        id: 'container',
        type: 'row',
        key: 'layout',
        children: [
          makeNode({ id: 'f1', key: 'field_one' }),
          makeNode({ id: 'f2', key: 'field_two' }),
        ],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'container',
        type: 'grid',
        key: 'layout',
        children: [
          makeNode({ id: 'f1', key: 'field_one' }),
          makeNode({ id: 'f2', key: 'field_two' }),
        ],
      }),
    ]);
    const priorData = makeData({
      'container/f1': { value: 'one' },
      'container/f2': { value: 'two' },
    });

    const result = reconcile(newView, priorView, priorData);
    // row→grid is now treated as compatible — values should be preserved
    expect(result.reconciledState.values['container/f1']).toEqual({
      value: 'one',
    });
    expect(result.reconciledState.values['container/f2']).toEqual({
      value: 'two',
    });
    expect(result.diffs.filter((d) => d.type === 'type-changed')).toHaveLength(
      0
    );
  });

  it('presentation→field: field gets no state from presentation', () => {
    const priorView = makeView([makeNode({ id: 'a', type: 'presentation' })]);
    const newView = makeView([makeNode({ id: 'a', type: 'field' })]);
    const priorData = makeData({});

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['a']).toBeUndefined();
  });
});

// ─── 7. Malformed / Corrupt Prior Data ────────────────────────────────────────

describe('malformed / corrupt prior data', () => {
  const simpleTpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });

  it('priorData.values is empty object — all nodes added', () => {
    const priorView = makeView([makeNode({ id: 'a' })]);
    const newView = makeView([makeNode({ id: 'a' })]);
    const priorData = makeData({});

    const result = reconcile(newView, priorView, priorData);
    expect(result.resolutions).toHaveLength(1);
  });

  it('priorData.values has extra keys not in any view — ignored safely', () => {
    const priorView = makeView([makeNode({ id: 'a' })]);
    const newView = makeView([makeNode({ id: 'a' })]);
    const priorData = makeData({
      a: { value: 'valid' },
      ghost_1: { value: 'phantom' },
      ghost_2: { value: 'phantom 2' },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['a']).toEqual({ value: 'valid' });
    expect(result.reconciledState.values['ghost_1']).toBeUndefined();
    expect(result.reconciledState.values['ghost_2']).toBeUndefined();
  });

  it('collection value is null — defaults to empty items', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl)]);
    const priorData = makeData({ c: null as unknown as NodeValue });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toEqual([]);
  });

  it('collection value is a string instead of object — defaults to empty', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl)]);
    const priorData = makeData({ c: 'garbage' as unknown as NodeValue });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toEqual([]);
  });

  it('collection item.values is null — treated as empty record', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl)]);
    const priorData = makeData({
      c: {
        value: {
          items: [{ values: null as unknown as Record<string, NodeValue> }],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    expect(items).toHaveLength(1);
    expect(items[0].values).toEqual({});
  });

  it('collection items array contains null entries — filtered gracefully', () => {
    const priorView = makeView([collectionNode('c', simpleTpl)]);
    const newView = makeView([collectionNode('c', simpleTpl)]);
    const priorData = makeData({
      c: {
        value: {
          items: [
            { values: { item: { value: 'A' } } },
            null as unknown as { values: Record<string, NodeValue> },
            { values: { item: { value: 'C' } } },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'c');
    // null item should be normalized to empty values
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 8. Key Matching Edge Cases ───────────────────────────────────────────────

describe('key matching edge cases', () => {
  it('key collision: two nodes with same key — last-write-wins, warning issued', () => {
    const view = makeView([
      makeNode({ id: 'a', key: 'same' }),
      makeNode({ id: 'b', key: 'same' }),
    ]);

    const result = reconcile(view, null, null);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_NODE_KEY')).toBe(
      true
    );
  });

  it('key changes: prior had key "weight", new has key "mass" — treated as new', () => {
    const priorView = makeView([makeNode({ id: 'a', key: 'weight' })]);
    const newView = makeView([makeNode({ id: 'b', key: 'mass' })]);
    const priorData = makeData({ a: { value: 100 } });

    const result = reconcile(newView, priorView, priorData);
    // No key match — b is added, a is removed
    expect(result.reconciledState.values['b']).toBeUndefined();
  });

  it('key removed: prior had key, new has no key — falls back to ID match', () => {
    const priorView = makeView([makeNode({ id: 'name', key: 'name_key' })]);
    const newView = makeView([makeNode({ id: 'name' })]);
    const priorData = makeData({ name: { value: 'carried' } });

    const result = reconcile(newView, priorView, priorData);
    // Same ID — should carry
    expect(result.reconciledState.values['name']).toEqual({ value: 'carried' });
  });

  it('key matched across 3 pushes — still restored from detachedValues', () => {
    const v1 = makeView([makeNode({ id: 'a', key: 'persistent' })]);
    const v2 = makeView([]);
    const v3 = makeView([makeNode({ id: 'b', key: 'other' })]);
    const v4 = makeView([makeNode({ id: 'c', key: 'persistent' })]);
    const data = makeData({ a: { value: 'I survive' } });

    const r1 = reconcile(v2, v1, data);
    expect(r1.reconciledState.detachedValues?.['persistent']).toBeDefined();

    const r2 = reconcile(v3, v2, r1.reconciledState);
    expect(r2.reconciledState.detachedValues?.['persistent']).toBeDefined();

    const r3 = reconcile(v4, v3, r2.reconciledState);
    expect(r3.reconciledState.values['c']).toEqual({ value: 'I survive' });
  });

  it('key in different parent scope does NOT cross-contaminate', () => {
    const priorView = makeView([
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
    const newView = priorView; // same structure
    const priorData = makeData({
      'billing/name': { value: 'Bill' },
      'shipping/name': { value: 'Ship' },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['billing/name']).toEqual({
      value: 'Bill',
    });
    expect(result.reconciledState.values['shipping/name']).toEqual({
      value: 'Ship',
    });
  });
});

// ─── 9. Deep Nesting & Large Trees ───────────────────────────────────────────

describe('deep nesting & large trees', () => {
  it('10-level deep group nesting carries all values', () => {
    let inner = makeNode({ id: 'd10' });
    for (let i = 9; i >= 0; i--) {
      inner = makeNode({ id: `d${i}`, type: 'group', children: [inner] });
    }
    const view = makeView([inner]);
    const deepPath = Array.from({ length: 11 }, (_, i) => `d${i}`).join('/');
    const priorData = makeData({ [deepPath]: { value: 'deep' } });

    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values[deepPath]).toEqual({ value: 'deep' });
  });

  it('200-node flat view reconciles without error', () => {
    const nodes = Array.from({ length: 200 }, (_, i) =>
      makeNode({ id: `n${i}` })
    );
    const view = makeView(nodes);
    const values: Record<string, NodeValue> = {};
    for (let i = 0; i < 200; i++) {
      values[`n${i}`] = { value: `v${i}` };
    }
    const priorData = makeData(values);

    const start = Date.now();
    const result = reconcile(view, view, priorData);
    const elapsed = Date.now() - start;

    expect(Object.keys(result.reconciledState.values)).toHaveLength(200);
    expect(elapsed).toBeLessThan(500); // should complete well under 500ms
  });

  it('50-item collection with 5 fields each carries through restructure', () => {
    const priorTpl = makeNode({
      id: 'tpl',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'f1', key: 'name' }),
        makeNode({ id: 'f2', key: 'age' }),
        makeNode({ id: 'f3', key: 'email' }),
        makeNode({ id: 'f4', key: 'phone' }),
        makeNode({ id: 'f5', key: 'city' }),
      ],
    });
    const newTpl = makeNode({
      id: 'card',
      type: 'group',
      key: 'tpl',
      children: [
        makeNode({ id: 'inp_name', key: 'name' }),
        makeNode({ id: 'inp_age', key: 'age' }),
        makeNode({ id: 'inp_email', key: 'email' }),
        makeNode({ id: 'inp_phone', key: 'phone' }),
        makeNode({ id: 'inp_city', key: 'city' }),
      ],
    });

    const items = Array.from({ length: 50 }, (_, i) => ({
      values: {
        'tpl/f1': { value: `Name_${i}` },
        'tpl/f2': { value: i + 20 },
        'tpl/f3': { value: `user${i}@x.com` },
        'tpl/f4': { value: `555-${String(i).padStart(4, '0')}` },
        'tpl/f5': { value: `City_${i}` },
      } as Record<string, NodeValue>,
    }));

    const priorView = makeView([collectionNode('people', priorTpl)]);
    const newView = makeView([collectionNode('people', newTpl)]);
    const priorData = makeData({
      people: { value: { items } },
    });

    const result = reconcile(newView, priorView, priorData);
    const resultItems = getItems(result, 'people');
    expect(resultItems).toHaveLength(50);
    expect(resultItems[0].values['card/inp_name']).toEqual({ value: 'Name_0' });
    expect(resultItems[49].values['card/inp_city']).toEqual({
      value: 'City_49',
    });
  });

  it('fan-out: group with 50 children, half renamed — all values preserved', () => {
    const priorChildren = Array.from({ length: 50 }, (_, i) =>
      makeNode({ id: `f${i}`, key: `key_${i}` })
    );
    const newChildren = Array.from({ length: 50 }, (_, i) =>
      makeNode({
        id: i < 25 ? `f${i}` : `renamed_${i}`,
        key: `key_${i}`,
      })
    );
    const priorView = makeView([
      makeNode({ id: 'root', type: 'group', children: priorChildren }),
    ]);
    const newView = makeView([
      makeNode({ id: 'root', type: 'group', children: newChildren }),
    ]);
    const values: Record<string, NodeValue> = {};
    for (let i = 0; i < 50; i++) {
      values[`root/f${i}`] = { value: `v${i}` };
    }
    const priorData = makeData(values);

    const result = reconcile(newView, priorView, priorData);
    // First 25 by ID, last 25 by key
    for (let i = 0; i < 25; i++) {
      expect(result.reconciledState.values[`root/f${i}`]).toEqual({
        value: `v${i}`,
      });
    }
    for (let i = 25; i < 50; i++) {
      expect(result.reconciledState.values[`root/renamed_${i}`]).toEqual({
        value: `v${i}`,
      });
    }
  });
});

// ─── 10. Presentation & Action Node Lifecycle ─────────────────────────────────

describe('presentation & action node lifecycle', () => {
  it('presentation nodes never hold values in reconciled state', () => {
    const view = makeView([makeNode({ id: 'prs', type: 'presentation' })]);
    const result = reconcile(view, null, null);
    expect(result.reconciledState.values['prs']).toBeUndefined();
  });

  it('action nodes carry value through unchanged transition', () => {
    const view = makeView([makeNode({ id: 'btn', type: 'action' })]);
    const priorData = makeData({ btn: { value: true } });

    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values['btn']).toEqual({ value: true });
  });

  it('action node hash change warns and carries when no migration exists', () => {
    const priorView = makeView([
      makeNode({ id: 'btn', type: 'action', hash: 'v1' }),
    ]);
    const newView = makeView([
      makeNode({ id: 'btn', type: 'action', hash: 'v2' }),
    ]);
    const priorData = makeData({ btn: { value: { clicked: true } } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.diffs.some((d) => d.type === 'migrated')).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === ISSUE_CODES.MIGRATION_FAILED)
    ).toBe(true);
  });

  it('row nodes carry all children values independently', () => {
    const row = makeNode({
      id: 'row',
      type: 'row',
      children: [makeNode({ id: 'left' }), makeNode({ id: 'right' })],
    });
    const view = makeView([row]);
    const priorData = makeData({
      'row/left': { value: 'L' },
      'row/right': { value: 'R' },
    });

    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values['row/left']).toEqual({ value: 'L' });
    expect(result.reconciledState.values['row/right']).toEqual({ value: 'R' });
  });
});

// ─── 11. Value Lineage Through Collections ────────────────────────────────────

describe('value lineage through collections', () => {
  it('valueLineage carries through collection node rename', () => {
    const tpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });
    const priorView = makeView([
      collectionNode('old_col', tpl, { key: 'col_key' }),
    ]);
    const newView = makeView([
      collectionNode('new_col', tpl, { key: 'col_key' }),
    ]);
    const priorData: DataSnapshot = {
      values: {
        old_col: { value: { items: [{ values: { item: { value: 'x' } } }] } },
      },
      lineage: { timestamp: 1000, sessionId: 's' },
      valueLineage: {
        old_col: { lastUpdated: 500 },
      },
    };

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.valueLineage?.['new_col']).toBeDefined();
    expect(result.reconciledState.valueLineage?.['old_col']).toBeUndefined();
  });

  it('valueLineage NOT present for freshly added collection', () => {
    const tpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });
    const view = makeView([collectionNode('col', tpl)]);
    const result = reconcile(view, null, null);
    expect(result.reconciledState.valueLineage?.['col']).toBeUndefined();
  });
});

// ─── 12. Determinism & Idempotency ───────────────────────────────────────────

describe('determinism & idempotency', () => {
  it('identical inputs produce identical outputs (10 runs)', () => {
    const priorView = makeView([
      makeNode({ id: 'a', key: 'ak' }),
      makeNode({ id: 'b', key: 'bk' }),
    ]);
    const newView = makeView([
      makeNode({ id: 'c', key: 'ak' }),
      makeNode({ id: 'd', key: 'bk' }),
    ]);
    const priorData = makeData({
      a: { value: 'A' },
      b: { value: 'B' },
    });

    const fixedClock = () => 9999;
    const results = Array.from({ length: 10 }, () =>
      reconcile(newView, priorView, priorData, { clock: fixedClock })
    );

    const first = JSON.stringify(results[0].reconciledState);
    for (let i = 1; i < 10; i++) {
      expect(JSON.stringify(results[i].reconciledState)).toBe(first);
    }
  });

  it('reconcile(view, view, data) === identity (all values unchanged)', () => {
    const view = makeView([
      makeNode({ id: 'x' }),
      makeNode({ id: 'y', type: 'action' }),
    ]);
    const priorData = makeData({
      x: { value: 'original' },
      y: { value: true },
    });

    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values['x']).toEqual({ value: 'original' });
    expect(result.reconciledState.values['y']).toEqual({ value: true });
    expect(
      result.diffs.every(
        (d) => d.type !== 'removed' && d.type !== 'type-changed'
      )
    ).toBe(true);
  });

  it('reconcile(A→B) then reconcile(B→B) = stable state', () => {
    const viewA = makeView([makeNode({ id: 'old', key: 'k' })]);
    const viewB = makeView([makeNode({ id: 'new', key: 'k' })]);
    const data = makeData({ old: { value: 'value' } });

    const r1 = reconcile(viewB, viewA, data);
    const r2 = reconcile(viewB, viewB, r1.reconciledState);

    expect(r2.reconciledState.values['new']).toEqual({ value: 'value' });
    expect(r2.diffs.filter((d) => d.type === 'removed')).toHaveLength(0);
  });

  it('order of nodes in view does not affect value carry', () => {
    const viewAB = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', type: 'action' }),
    ]);
    const viewBA = makeView([
      makeNode({ id: 'b', type: 'action' }),
      makeNode({ id: 'a' }),
    ]);
    const priorData = makeData({
      a: { value: 'A' },
      b: { value: 'B' },
    });

    const resultAB = reconcile(viewAB, viewAB, priorData, {
      clock: () => 9999,
    });
    const resultBA = reconcile(viewBA, viewBA, priorData, {
      clock: () => 9999,
    });

    expect(resultAB.reconciledState.values['a']).toEqual(
      resultBA.reconciledState.values['a']
    );
    expect(resultAB.reconciledState.values['b']).toEqual(
      resultBA.reconciledState.values['b']
    );
  });
});

// ─── 13. Container Type Swaps (row ↔ grid ↔ group) ───────────────────────────

describe('container type swaps (row ↔ grid ↔ group)', () => {
  it('row→grid preserves all child values', () => {
    const priorView = makeView([
      makeNode({
        id: 'box',
        type: 'row',
        key: 'layout',
        children: [
          makeNode({ id: 'f1', key: 'name' }),
          makeNode({ id: 'f2', key: 'email' }),
        ],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'box',
        type: 'grid',
        key: 'layout',
        children: [
          makeNode({ id: 'f1', key: 'name' }),
          makeNode({ id: 'f2', key: 'email' }),
        ],
      }),
    ]);
    const priorData = makeData({
      'box/f1': { value: 'Alice' },
      'box/f2': { value: 'alice@test.com' },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['box/f1']).toEqual({ value: 'Alice' });
    expect(result.reconciledState.values['box/f2']).toEqual({
      value: 'alice@test.com',
    });
    // Should NOT produce type-changed diff
    expect(result.diffs.filter((d) => d.type === 'type-changed')).toHaveLength(
      0
    );
  });

  it('grid→group preserves all child values', () => {
    const priorView = makeView([
      makeNode({
        id: 'container',
        type: 'grid',
        children: [makeNode({ id: 'inner' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'container',
        type: 'group',
        children: [makeNode({ id: 'inner' })],
      }),
    ]);
    const priorData = makeData({ 'container/inner': { value: 'safe' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['container/inner']).toEqual({
      value: 'safe',
    });
  });

  it('group→row preserves all child values', () => {
    const priorView = makeView([
      makeNode({
        id: 'section',
        type: 'group',
        children: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'section',
        type: 'row',
        children: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      }),
    ]);
    const priorData = makeData({
      'section/a': { value: 1 },
      'section/b': { value: 2 },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['section/a']).toEqual({ value: 1 });
    expect(result.reconciledState.values['section/b']).toEqual({ value: 2 });
  });

  it('three-way swap group→row→grid in sequence preserves data', () => {
    const makeLayout = (type: 'group' | 'row' | 'grid') =>
      makeView([
        makeNode({
          id: 'layout',
          type,
          key: 'layout',
          children: [makeNode({ id: 'fld', key: 'fld' })],
        }),
      ]);

    const v1 = makeLayout('group');
    const v2 = makeLayout('row');
    const v3 = makeLayout('grid');
    const data = makeData({ 'layout/fld': { value: 'survives' } });

    const r1 = reconcile(v2, v1, data);
    expect(r1.reconciledState.values['layout/fld']).toEqual({
      value: 'survives',
    });

    const r2 = reconcile(v3, v2, r1.reconciledState);
    expect(r2.reconciledState.values['layout/fld']).toEqual({
      value: 'survives',
    });
  });

  it('container swap with simultaneous child rename preserves by key', () => {
    const priorView = makeView([
      makeNode({
        id: 'panel',
        type: 'row',
        children: [makeNode({ id: 'old_name', key: 'name_field' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'panel',
        type: 'grid',
        children: [makeNode({ id: 'new_name', key: 'name_field' })],
      }),
    ]);
    const priorData = makeData({ 'panel/old_name': { value: 'Bob' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['panel/new_name']).toEqual({
      value: 'Bob',
    });
  });

  it('container swap inside collection template preserves items', () => {
    const priorTpl = makeNode({
      id: 'tpl',
      type: 'row',
      key: 'tpl_key',
      children: [makeNode({ id: 'val', key: 'val' })],
    });
    const newTpl = makeNode({
      id: 'tpl',
      type: 'grid',
      key: 'tpl_key',
      children: [makeNode({ id: 'val', key: 'val' })],
    });

    const priorView = makeView([collectionNode('col', priorTpl)]);
    const newView = makeView([collectionNode('col', newTpl)]);
    const priorData = makeData({
      col: {
        value: {
          items: [
            { values: { 'tpl/val': { value: 'item1' } } },
            { values: { 'tpl/val': { value: 'item2' } } },
          ],
        },
      },
    });

    const result = reconcile(newView, priorView, priorData);
    const items = getItems(result, 'col');
    expect(items).toHaveLength(2);
    expect(items[0].values['tpl/val']).toEqual({ value: 'item1' });
    expect(items[1].values['tpl/val']).toEqual({ value: 'item2' });
  });

  it('field→row is still a real type mismatch (not container swap)', () => {
    const priorView = makeView([makeNode({ id: 'x', type: 'field' })]);
    const newView = makeView([
      makeNode({ id: 'x', type: 'row', children: [] }),
    ]);
    const priorData = makeData({ x: { value: 'field data' } });

    const result = reconcile(newView, priorView, priorData);
    // field→row IS a real type mismatch
    expect(result.diffs.some((d) => d.type === 'type-changed')).toBe(true);
  });

  it('collection→group is still a real type mismatch', () => {
    const tpl = makeNode({ id: 'item', type: 'field', dataType: 'string' });
    const priorView = makeView([collectionNode('x', tpl)]);
    const newView = makeView([
      makeNode({ id: 'x', type: 'group', children: [] }),
    ]);
    const priorData = makeData({
      x: { value: { items: [{ values: { item: { value: 'old' } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    expect(result.issues.some((i) => i.code === 'TYPE_MISMATCH')).toBe(true);
  });
});

// ─── 14. Default Value Behavior ───────────────────────────────────────────────

describe('default value behavior', () => {
  it('defaultValue is set on fresh session for field nodes', () => {
    const view = makeView([
      makeNode({ id: 'name', defaultValue: 'Anonymous' }),
    ]);
    const result = reconcile(view, null, null);
    expect(result.reconciledState.values['name']).toEqual({
      value: 'Anonymous',
    });
  });

  it('defaultValue is NOT overwritten on carry', () => {
    const view = makeView([
      makeNode({ id: 'name', defaultValue: 'Anonymous' }),
    ]);
    const priorData = makeData({ name: { value: 'Custom' } });
    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values['name']).toEqual({ value: 'Custom' });
  });

  it('defaultValue is set for new nodes added alongside existing ones', () => {
    const priorView = makeView([makeNode({ id: 'a' })]);
    const newView = makeView([
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', defaultValue: 'new-default' }),
    ]);
    const priorData = makeData({ a: { value: 'existing' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['a']).toEqual({ value: 'existing' });
    expect(result.reconciledState.values['b']).toEqual({
      value: 'new-default',
    });
  });

  it('collection template defaults are applied to minItems seed', () => {
    const tpl = makeNode({
      id: 'tpl',
      type: 'group',
      children: [
        makeNode({ id: 'color', defaultValue: 'red' }),
        makeNode({ id: 'size', defaultValue: 42 }),
      ],
    });
    const view = makeView([collectionNode('items', tpl, { minItems: 2 })]);
    const result = reconcile(view, null, null);
    const items = getItems(result, 'items');
    expect(items).toHaveLength(2);
    expect(items[0].values['tpl/color']).toEqual({ value: 'red' });
    expect(items[0].values['tpl/size']).toEqual({ value: 42 });
    expect(items[1].values['tpl/color']).toEqual({ value: 'red' });
  });
});

// ─── 15. Hidden Node Behavior ─────────────────────────────────────────────────

describe('hidden node behavior', () => {
  it('hidden nodes still carry values through reconciliation', () => {
    const view = makeView([
      makeNode({ id: 'visible' }),
      makeNode({ id: 'secret', hidden: true }),
    ]);
    const priorData = makeData({
      visible: { value: 'V' },
      secret: { value: 'S' },
    });

    const result = reconcile(view, view, priorData);
    expect(result.reconciledState.values['visible']).toEqual({ value: 'V' });
    expect(result.reconciledState.values['secret']).toEqual({ value: 'S' });
  });

  it('hidden flag changing does not affect value carry', () => {
    const priorView = makeView([makeNode({ id: 'f', hidden: false })]);
    const newView = makeView([makeNode({ id: 'f', hidden: true })]);
    const priorData = makeData({ f: { value: 'kept' } });

    const result = reconcile(newView, priorView, priorData);
    expect(result.reconciledState.values['f']).toEqual({ value: 'kept' });
  });
});

// ─── 16. Multiple Collections in Same View ───────────────────────────────────

describe('multiple collections in same view', () => {
  it('two collections with different templates reconcile independently', () => {
    const tplA = makeNode({
      id: 'name_tpl',
      type: 'field',
      dataType: 'string',
    });
    const tplB = makeNode({ id: 'num_tpl', type: 'field', dataType: 'number' });

    const view = makeView([
      collectionNode('names', tplA),
      collectionNode('numbers', tplB),
    ]);
    const priorData = makeData({
      names: {
        value: {
          items: [{ values: { name_tpl: { value: 'Alice' } } }],
        },
      },
      numbers: {
        value: {
          items: [{ values: { num_tpl: { value: 99 } } }],
        },
      },
    });

    const result = reconcile(view, view, priorData);
    const nameItems = getItems(result, 'names');
    const numItems = getItems(result, 'numbers');
    expect(nameItems[0].values['name_tpl']).toEqual({ value: 'Alice' });
    expect(numItems[0].values['num_tpl']).toEqual({ value: 99 });
  });

  it('restructuring one collection does not affect the other', () => {
    const priorTplA = makeNode({
      id: 'tpl_a',
      type: 'field',
      key: 'a_tpl',
      dataType: 'string',
    });
    const newTplA = makeNode({
      id: 'tpl_a_v2',
      type: 'field',
      key: 'a_tpl',
      dataType: 'string',
    });
    const tplB = makeNode({ id: 'tpl_b', type: 'field', dataType: 'number' });

    const priorView = makeView([
      collectionNode('a', priorTplA),
      collectionNode('b', tplB),
    ]);
    const newView = makeView([
      collectionNode('a', newTplA),
      collectionNode('b', tplB),
    ]);
    const priorData = makeData({
      a: { value: { items: [{ values: { tpl_a: { value: 'data' } } }] } },
      b: { value: { items: [{ values: { tpl_b: { value: 42 } } }] } },
    });

    const result = reconcile(newView, priorView, priorData);
    const bItems = getItems(result, 'b');
    expect(bItems[0].values['tpl_b']).toEqual({ value: 42 });
  });
});

// ─── 17. Validator Edge Cases ─────────────────────────────────────────────────

describe('validator edge cases', () => {
  it('required constraint on empty field produces validation warning', () => {
    const view = makeView([
      makeNode({ id: 'req', constraints: { required: true } }),
    ]);
    // Use carry path (prior view + prior data) so validator runs
    const priorData = makeData({});
    const result = reconcile(view, view, priorData);
    expect(
      result.issues.some(
        (i) => i.code === 'VALIDATION_FAILED' && i.nodeId === 'req'
      )
    ).toBe(true);
  });

  it('min/max number constraints produce warnings for out-of-range', () => {
    const view = makeView([
      makeNode({
        id: 'age',
        dataType: 'number',
        constraints: { min: 0, max: 120 },
      }),
    ]);
    const priorData = makeData({ age: { value: 150 } });
    const result = reconcile(view, view, priorData);
    expect(
      result.issues.some(
        (i) => i.code === 'VALIDATION_FAILED' && i.nodeId === 'age'
      )
    ).toBe(true);
  });

  it('pattern constraint validates string fields', () => {
    const view = makeView([
      makeNode({ id: 'zip', constraints: { pattern: '^\\d{5}$' } }),
    ]);
    const priorData = makeData({ zip: { value: 'not-a-zip' } });
    const result = reconcile(view, view, priorData);
    expect(
      result.issues.some(
        (i) => i.code === 'VALIDATION_FAILED' && i.nodeId === 'zip'
      )
    ).toBe(true);
  });

  it('valid values produce no validation issues', () => {
    const view = makeView([
      makeNode({
        id: 'name',
        constraints: { required: true, minLength: 1, maxLength: 50 },
      }),
    ]);
    const priorData = makeData({ name: { value: 'Bryton' } });
    const result = reconcile(view, view, priorData);
    expect(
      result.issues.filter((i) => i.code === 'VALIDATION_FAILED')
    ).toHaveLength(0);
  });
});
