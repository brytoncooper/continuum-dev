import { describe, expect, it, vi } from 'vitest';
import type {
  DataSnapshot,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { MigrationStrategy, ReconciliationOptions } from '../../types.js';
import { reconcile as runtimeReconcile } from '../../reconcile/index.js';
import { attemptMigration } from './index.js';

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

function makeData(values: Record<string, NodeValue>): DataSnapshot {
  return {
    values,
    lineage: {
      timestamp: 1000,
      sessionId: 'test-session',
    },
  };
}

describe('migration chains', () => {
  it('applies a 2-step chain v1->v2->v3 in order', () => {
    const v1ToV2: MigrationStrategy = vi.fn(
      (_id, _priorNode, _newNode, prior) => {
        const value = prior as NodeValue<string>;
        return { value: `${value.value}-v2` };
      }
    );
    const v2ToV3: MigrationStrategy = vi.fn(
      (_id, _priorNode, _newNode, prior) => {
        const value = prior as NodeValue<string>;
        return { value: `${value.value}-v3` };
      }
    );
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'v1-to-v2' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'v2-to-v3' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          'v1-to-v2': v1ToV2,
          'v2-to-v3': v2ToV3,
        },
      }
    );
    expect(result).toEqual({
      kind: 'migrated',
      value: { value: 'base-v2-v3' },
    });
    expect(v1ToV2).toHaveBeenCalledOnce();
    expect(v2ToV3).toHaveBeenCalledOnce();
  });

  it('applies a 3-step chain v1->v2->v3->v4', () => {
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v4',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'a' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'b' },
          { fromHash: 'v3', toHash: 'v4', strategyId: 'c' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          a: (_id, _p, _n, prior) => ({
            value: `${(prior as NodeValue<string>).value}-2`,
          }),
          b: (_id, _p, _n, prior) => ({
            value: `${(prior as NodeValue<string>).value}-3`,
          }),
          c: (_id, _p, _n, prior) => ({
            value: `${(prior as NodeValue<string>).value}-4`,
          }),
        },
      }
    );
    expect(result).toEqual({
      kind: 'migrated',
      value: { value: 'base-2-3-4' },
    });
  });

  it('prefers direct rule over chain when both are available', () => {
    const direct = vi.fn((_id, _p, _n, _prior) => ({ value: 'direct' }));
    const hop1 = vi.fn((_id, _p, _n, _prior) => ({ value: 'hop1' }));
    const hop2 = vi.fn((_id, _p, _n, _prior) => ({ value: 'hop2' }));
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v3', strategyId: 'direct' },
          { fromHash: 'v1', toHash: 'v2', strategyId: 'hop1' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'hop2' },
        ],
      }),
      { value: 'base' },
      { strategyRegistry: { direct, hop1, hop2 } }
    );
    expect(result).toEqual({ kind: 'migrated', value: { value: 'direct' } });
    expect(direct).toHaveBeenCalledOnce();
    expect(hop1).not.toHaveBeenCalled();
    expect(hop2).not.toHaveBeenCalled();
  });

  it('returns error when intermediate chain strategy throws', () => {
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'hop1' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'hop2' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          hop1: (_id, _p, _n, prior) => prior,
          hop2: () => {
            throw new Error('bad-hop');
          },
        },
      }
    );
    expect(result.kind).toBe('error');
  });

  it('returns none when an intermediate chain step is missing', () => {
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [{ fromHash: 'v1', toHash: 'v2', strategyId: 'hop1' }],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          hop1: (_id, _p, _n, prior) => prior,
        },
      }
    );
    expect(result).toEqual({ kind: 'none' });
  });

  it('returns none for circular rules without route to target hash', () => {
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v4',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'a' },
          { fromHash: 'v2', toHash: 'v1', strategyId: 'b' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          a: (_id, _p, _n, prior) => prior,
          b: (_id, _p, _n, prior) => prior,
        },
      }
    );
    expect(result).toEqual({ kind: 'none' });
  });

  it('enforces max chain depth', () => {
    const migrations = Array.from({ length: 12 }, (_, i) => ({
      fromHash: `v${i}`,
      toHash: `v${i + 1}`,
      strategyId: `s${i}`,
    }));
    const strategyRegistry = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => [
        `s${i}`,
        (_id: string, _p: ViewNode, _n: ViewNode, prior: unknown) => prior,
      ])
    ) as Record<string, MigrationStrategy>;
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v0' }),
      makeNode({
        id: 'name',
        hash: 'v12',
        migrations,
      }),
      { value: 'base' },
      { strategyRegistry }
    );
    expect(result).toEqual({ kind: 'none' });
  });

  it('retains single-step behavior', () => {
    const strategy = vi.fn((_id, _p, _n, _prior) => ({ value: 'single' }));
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v2',
        migrations: [{ fromHash: 'v1', toHash: 'v2', strategyId: 'single' }],
      }),
      { value: 'base' },
      { strategyRegistry: { single: strategy } }
    );
    expect(result).toEqual({ kind: 'migrated', value: { value: 'single' } });
    expect(strategy).toHaveBeenCalledOnce();
  });

  it('keeps explicit migrationStrategies priority over registry chains', () => {
    const explicit = vi.fn((_id, _p, _n, _prior) => ({ value: 'explicit' }));
    const chainA = vi.fn((_id, _p, _n, _prior) => ({ value: 'a' }));
    const chainB = vi.fn((_id, _p, _n, _prior) => ({ value: 'b' }));
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'chainA' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'chainB' },
        ],
      }),
      { value: 'base' },
      {
        migrationStrategies: { name: explicit },
        strategyRegistry: { chainA, chainB },
      }
    );
    expect(result).toEqual({ kind: 'migrated', value: { value: 'explicit' } });
    expect(explicit).toHaveBeenCalledOnce();
    expect(chainA).not.toHaveBeenCalled();
    expect(chainB).not.toHaveBeenCalled();
  });

  it('feeds each step output into the next step input', () => {
    const second = vi.fn((_id, _p, _n, prior) => {
      const value = prior as NodeValue<string>;
      return { value: `${value.value}-second` };
    });
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'first' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'second' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: {
          first: (_id, _p, _n, prior) => ({
            value: `${(prior as NodeValue<string>).value}-first`,
          }),
          second,
        },
      }
    );
    expect(result).toEqual({
      kind: 'migrated',
      value: { value: 'base-first-second' },
    });
    expect(second.mock.calls[0][3]).toEqual({ value: 'base-first' });
  });

  it('integrates with reconcile for chained migration', () => {
    const priorView = makeView([makeNode({ id: 'a', hash: 'v1' })]);
    const newView = makeView([
      makeNode({
        id: 'a',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'hop1' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'hop2' },
        ],
      }),
    ]);
    const priorData = makeData({ a: { value: 'base' } });
    const result = reconcile(newView, priorView, priorData, {
      strategyRegistry: {
        hop1: (_id, _p, _n, prior) => ({
          value: `${(prior as NodeValue<string>).value}-2`,
        }),
        hop2: (_id, _p, _n, prior) => ({
          value: `${(prior as NodeValue<string>).value}-3`,
        }),
      },
    });
    expect(result.reconciledState.values['a']).toEqual({ value: 'base-2-3' });
    expect(result.diffs.some((d) => d.type === 'migrated')).toBe(true);
    expect(result.resolutions.some((r) => r.resolution === 'migrated')).toBe(
      true
    );
  });

  it('returns none when strategyRegistry is missing for declared chain', () => {
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'hop1' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'hop2' },
        ],
      }),
      { value: 'base' },
      {}
    );
    expect(result).toEqual({ kind: 'none' });
  });

  it('provides per-step priorNode/newNode hashes to each strategy call', () => {
    const first = vi.fn((_id, priorNode, newNode, prior) => {
      expect(priorNode.hash).toBe('v1');
      expect(newNode.hash).toBe('v2');
      return prior;
    });
    const second = vi.fn((_id, priorNode, newNode, prior) => {
      expect(priorNode.hash).toBe('v2');
      expect(newNode.hash).toBe('v3');
      return prior;
    });
    const result = attemptMigration(
      'name',
      makeNode({ id: 'name', hash: 'v1' }),
      makeNode({
        id: 'name',
        hash: 'v3',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'first' },
          { fromHash: 'v2', toHash: 'v3', strategyId: 'second' },
        ],
      }),
      { value: 'base' },
      {
        strategyRegistry: { first, second },
      }
    );
    expect(result.kind).toBe('migrated');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
