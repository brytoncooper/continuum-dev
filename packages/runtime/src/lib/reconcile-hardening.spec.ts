import type {
  ViewDefinition,
  ViewNode,
  DataSnapshot,
} from '@continuum-dev/contract';
import { ISSUE_CODES } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import {
  buildPriorValueLookupByIdAndKey,
  buildReconciliationContext,
} from './context.js';
import { reconcile } from './reconcile.js';
import { computeViewHash } from './reconciliation/state-builder.js';

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

const priorView: ViewDefinition = {
  viewId: 'view-1',
  version: '1',
  nodes: [makeNode({ id: 'a', key: 'k', hash: 'h1' })],
};

const priorData: DataSnapshot = {
  values: { a: { value: 'old' } },
  lineage: { timestamp: 1, sessionId: 's' },
};

describe('runtime hardening', () => {
  it('treats null as a valid migrated value', () => {
    const nextView: ViewDefinition = {
      viewId: 'view-1',
      version: '2',
      nodes: [makeNode({ id: 'a', key: 'k', hash: 'h2' })],
    };

    const result = reconcile(nextView, priorView, priorData, {
      migrationStrategies: { a: () => null },
    });

    expect(result.reconciledState.values.a).toBeNull();
    expect(
      result.issues.some((issue) => issue.code === ISSUE_CODES.MIGRATION_FAILED)
    ).toBe(false);
    expect(result.diffs[0]).toEqual({
      nodeId: 'a',
      type: 'migrated',
      oldValue: { value: 'old' },
      newValue: null,
      reason: 'Node view changed, migration applied',
    });
  });

  it('captures migration strategy errors as MIGRATION_FAILED and carries prior value', () => {
    const nextView: ViewDefinition = {
      viewId: 'view-1',
      version: '2',
      nodes: [makeNode({ id: 'a', key: 'k', hash: 'h2' })],
    };

    const result = reconcile(nextView, priorView, priorData, {
      migrationStrategies: {
        a: () => {
          throw new Error('boom');
        },
      },
    });

    expect(result.reconciledState.values.a).toEqual({ value: 'old' });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: ISSUE_CODES.MIGRATION_FAILED,
        severity: 'warning',
      })
    );
  });

  it('uses a view hash format without separator collisions', () => {
    const one: ViewDefinition = {
      viewId: 'view-1',
      version: '1',
      nodes: [makeNode({ id: 'a', hash: 'a:b' })],
    };
    const two: ViewDefinition = {
      viewId: 'view-1',
      version: '1',
      nodes: [
        makeNode({ id: 'a', hash: 'a' }),
        makeNode({ id: 'b', hash: 'b' }),
      ],
    };

    expect(computeViewHash(one)).not.toBe(computeViewHash(two));
  });

  it('buildPriorValueLookupByIdAndKey resolves nested key matches to new ids', () => {
    const previous: ViewDefinition = {
      viewId: 'view-1',
      version: '1',
      nodes: [
        makeNode({
          id: 'root',
          type: 'group',
          children: [makeNode({ id: 'old-child', key: 'child-key' })],
        }),
      ],
    };
    const next: ViewDefinition = {
      viewId: 'view-1',
      version: '2',
      nodes: [
        makeNode({
          id: 'root',
          type: 'group',
          children: [makeNode({ id: 'new-child', key: 'child-key' })],
        }),
      ],
    };
    const context = buildReconciliationContext(next, previous);
    const data: DataSnapshot = {
      values: { 'root/old-child': { value: 'nested' } },
      lineage: { timestamp: 0, sessionId: 's' },
    };

    const lookup = buildPriorValueLookupByIdAndKey(data, context);
    expect(lookup.get('root/new-child')).toEqual({ value: 'nested' });
  });

  it('handles empty views without producing invalid arrays', () => {
    const next: ViewDefinition = { viewId: 'view-1', version: '2', nodes: [] };
    const result = reconcile(next, priorView, priorData);
    expect(result.reconciledState.values).toEqual({});
    expect(result.diffs).toEqual([
      {
        nodeId: 'a',
        type: 'removed',
        oldValue: { value: 'old' },
        reason: 'Node removed from view',
      },
    ]);
    expect(result.resolutions).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: ISSUE_CODES.NODE_REMOVED,
        nodeId: 'a',
      })
    );
    expect(result.reconciledState.detachedValues).toEqual({
      k: expect.objectContaining({
        value: { value: 'old' },
        previousNodeType: 'field',
        key: 'k',
        reason: 'node-removed',
      }),
    });
    expect(result.reconciledState.lineage.viewVersion).toBe('2');
    expect(result.reconciledState.lineage.timestamp).toBe(2);
  });

  it('reports cycle issues for cyclic child graphs', () => {
    const cycleRoot = makeNode({ id: 'root', type: 'group', children: [] });
    const cycleChild = makeNode({ id: 'child', type: 'group', children: [] });
    (cycleRoot as { children: ViewNode[] }).children.push(cycleChild);
    (cycleChild as { children: ViewNode[] }).children.push(cycleRoot);
    const cyclicView: ViewDefinition = {
      viewId: 'cycle-view',
      version: '1',
      nodes: [cycleRoot],
    };

    const result = reconcile(cyclicView, null, null);

    expect(
      result.issues.some(
        (issue) => issue.code === ISSUE_CODES.VIEW_CHILD_CYCLE_DETECTED
      )
    ).toBe(true);
  });

  it('reports max-depth issues for overly deep trees', () => {
    let current = makeNode({ id: 'n0', type: 'group', children: [] });
    const root = current;
    for (let i = 1; i < 300; i++) {
      const next = makeNode({ id: `n${i}`, type: 'group', children: [] });
      (current as { children: ViewNode[] }).children.push(next);
      current = next;
    }
    const deepView: ViewDefinition = {
      viewId: 'deep-view',
      version: '1',
      nodes: [root],
    };

    const result = reconcile(deepView, null, null);

    expect(
      result.issues.some(
        (issue) => issue.code === ISSUE_CODES.VIEW_MAX_DEPTH_EXCEEDED
      )
    ).toBe(true);
  });
});
