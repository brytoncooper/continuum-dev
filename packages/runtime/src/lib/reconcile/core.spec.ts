import { describe, it, expect, vi } from 'vitest';
import type {
  ViewDefinition,
  DataSnapshot,
  NodeValue,
} from '@continuum-dev/contract';
import { computeViewHash } from '../reconciliation/result-builder/index.js';
import type { MigrationStrategy } from '../types.js';
import {
  makeData,
  makeNode,
  makeView,
  reconcileWithFixedClock as reconcile,
} from './test-fixtures.js';

describe('reconcile', () => {
  describe('edge cases', () => {
    it('returns fresh state with NO_PRIOR_DATA info when no prior data exists', () => {
      const view = makeView([makeNode({ id: 'a' })]);

      const result = reconcile(view, null, null);

      expect(result.reconciledState.values).toEqual({});
      expect(result.reconciledState.lineage.viewId).toBe('view-1');
      expect(result.reconciledState.lineage.viewVersion).toBe('1.0');
      expect(result.reconciledState.lineage.sessionId).toBeDefined();
      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].type).toBe('added');
      expect(result.diffs[0].nodeId).toBe('a');
      expect(result.resolutions).toHaveLength(1);
      expect(result.resolutions[0].resolution).toBe('added');
      expect(result.resolutions[0].nodeId).toBe('a');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_DATA');
      expect(result.issues[0].severity).toBe('info');
    });

    it('returns warning when prior data exists but no prior view provided', () => {
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, null, priorData);

      expect(result.reconciledState.values).toEqual({});
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_VIEW');
      expect(result.issues[0].severity).toBe('warning');
    });

    it('carries values by id with UNVALIDATED_CARRY issues when allowPriorDataWithoutPriorView is true and no prior view', () => {
      const newView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const priorData = makeData({
        a: { value: 'hello' },
        b: { value: true },
      });

      const result = reconcile(newView, null, priorData, {
        allowPriorDataWithoutPriorView: true,
      });

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      expect(result.reconciledState.values['b']).toEqual({ value: true });

      const unvalidatedIssues = result.issues.filter(
        (i) => i.code === 'UNVALIDATED_CARRY'
      );
      expect(unvalidatedIssues).toHaveLength(2);
      expect(unvalidatedIssues.every((i) => i.severity === 'info')).toBe(true);
    });

    it('only carries values for nodes present in new view when allowPriorDataWithoutPriorView is true', () => {
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({
        a: { value: 'hello' },
        orphan: { value: 'gone' },
      });

      const result = reconcile(newView, null, priorData, {
        allowPriorDataWithoutPriorView: true,
      });

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      expect(result.reconciledState.values['orphan']).toBeUndefined();
    });

    it('carries values for nested nodes when allowPriorDataWithoutPriorView is true', () => {
      const newView = makeView([
        makeNode({
          id: 'section',
          type: 'group',
          children: [makeNode({ id: 'nested-input' })],
        }),
      ]);
      const priorData = makeData({
        'section/nested-input': { value: 'carried' },
      });

      const result = reconcile(newView, null, priorData, {
        allowPriorDataWithoutPriorView: true,
      });

      expect(result.reconciledState.values['section/nested-input']).toEqual({
        value: 'carried',
      });
    });

    it('still emits NO_PRIOR_VIEW warning alongside UNVALIDATED_CARRY when allowPriorDataWithoutPriorView is true', () => {
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, null, priorData, {
        allowPriorDataWithoutPriorView: true,
      });

      expect(
        result.issues.find((i) => i.code === 'NO_PRIOR_VIEW')
      ).toBeDefined();
      expect(
        result.issues.find((i) => i.code === 'UNVALIDATED_CARRY')
      ).toBeDefined();
    });

    it('keeps context issues before assembled transition issues', () => {
      const priorView = makeView([makeNode({ id: 'legacy' })]);
      const newView = makeView([makeNode({ id: 'dup' }), makeNode({ id: 'dup' })]);
      const priorData = makeData({ legacy: { value: 'old' } });

      const result = reconcile(newView, priorView, priorData);
      const duplicateIndex = result.issues.findIndex(
        (issue) => issue.code === 'DUPLICATE_NODE_ID'
      );
      const removedIndex = result.issues.findIndex(
        (issue) => issue.code === 'NODE_REMOVED'
      );

      expect(duplicateIndex).toBeGreaterThanOrEqual(0);
      expect(removedIndex).toBeGreaterThanOrEqual(0);
      expect(duplicateIndex).toBeLessThan(removedIndex);
    });
  });

  describe('node matching', () => {
    it('carries state over when node matched by id', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    });

    it('carries state over when node matched by key (id changed)', () => {
      const priorView = makeView([makeNode({ id: 'old-id', key: 'email' })]);
      const newView = makeView([makeNode({ id: 'new-id', key: 'email' })]);
      const priorData = makeData({ 'old-id': { value: 'test@example.com' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['new-id']).toEqual({
        value: 'test@example.com',
      });
    });
  });

  describe('diff generation', () => {
    it('produces added diff for new nodes', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const addedDiff = result.diffs.find((d) => d.nodeId === 'b');
      expect(addedDiff).toBeDefined();
      expect(addedDiff!.type).toBe('added');
    });

    it('produces removed diff and warning for removed nodes', () => {
      const priorView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({
        a: { value: 'hello' },
        b: { value: true },
      });

      const result = reconcile(newView, priorView, priorData);

      const removedDiff = result.diffs.find((d) => d.nodeId === 'b');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
      expect(removedDiff!.oldValue).toEqual({ value: true });

      const removedIssue = result.issues.find((i) => i.code === 'NODE_REMOVED');
      expect(removedIssue).toBeDefined();
      expect(removedIssue!.severity).toBe('warning');
    });

    it('suppresses NODE_REMOVED warning when allowPartialRestore is true', () => {
      const priorView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({
        a: { value: 'hello' },
        b: { value: true },
      });

      const result = reconcile(newView, priorView, priorData, {
        allowPartialRestore: true,
      });

      const removedDiff = result.diffs.find((d) => d.nodeId === 'b');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');

      const removedIssue = result.issues.find((i) => i.code === 'NODE_REMOVED');
      expect(removedIssue).toBeUndefined();
    });
  });

  describe('type validation', () => {
    it('reports TYPE_MISMATCH error and type-changed diff when node type changes', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a', type: 'action' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const issue = result.issues.find((i) => i.code === 'TYPE_MISMATCH');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');

      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();
      expect(diff!.nodeId).toBe('a');
      expect(diff!.oldValue).toEqual({ value: 'hello' });
      expect(diff!.reason).toContain('field');
      expect(diff!.reason).toContain('action');
    });

    it('does not carry incompatible state on type mismatch', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a', type: 'action' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['a']).toBeUndefined();
      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();
      expect(diff!.oldValue).toEqual({ value: 'hello' });
    });
  });

  describe('view migration', () => {
    it('carries state forward and warns when hash changes without a strategy', () => {
      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([makeNode({ id: 'a', hash: 'hash-v2' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      expect(result.diffs.find((d) => d.type === 'migrated')).toBeUndefined();
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'MIGRATION_FAILED',
          nodeId: 'a',
          severity: 'warning',
        })
      );
    });

    it('calls explicit migration strategy when provided via options', () => {
      const strategy: MigrationStrategy = vi.fn(({ priorValue }) => {
        return { value: (priorValue as { value: string }).value.toUpperCase() };
      });

      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([makeNode({ id: 'a', hash: 'hash-v2' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData, {
        migrationStrategies: { a: strategy },
      });

      expect(strategy).toHaveBeenCalledOnce();
      expect(result.reconciledState.values['a']).toEqual({ value: 'HELLO' });
      expect(result.diffs.find((d) => d.type === 'migrated')).toBeDefined();
    });

    it('uses view-declared migration rule with strategyRegistry', () => {
      const registryStrategy: MigrationStrategy = vi.fn(({ priorValue }) => {
        return {
          value: (priorValue as { value: string }).value + '-migrated',
        };
      });

      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([
        makeNode({
          id: 'a',
          hash: 'hash-v2',
          migrations: [
            {
              fromHash: 'hash-v1',
              toHash: 'hash-v2',
              strategyId: 'input-v1-to-v2',
            },
          ],
        }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData, {
        strategyRegistry: {
          'input-v1-to-v2': registryStrategy,
        },
      });

      expect(registryStrategy).toHaveBeenCalledOnce();
      expect(result.reconciledState.values['a']).toEqual({
        value: 'hello-migrated',
      });
      expect(result.diffs.find((d) => d.type === 'migrated')).toBeDefined();
    });

    it('prefers explicit migrationStrategies over view-declared migrations', () => {
      const explicitStrategy: MigrationStrategy = vi.fn(() => ({
        value: 'explicit',
      }));
      const registryStrategy: MigrationStrategy = vi.fn(() => ({
        value: 'registry',
      }));

      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([
        makeNode({
          id: 'a',
          hash: 'hash-v2',
          migrations: [
            {
              fromHash: 'hash-v1',
              toHash: 'hash-v2',
              strategyId: 'some-id',
            },
          ],
        }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData, {
        migrationStrategies: { a: explicitStrategy },
        strategyRegistry: { 'some-id': registryStrategy },
      });

      expect(explicitStrategy).toHaveBeenCalledOnce();
      expect(registryStrategy).not.toHaveBeenCalled();
      expect(result.reconciledState.values['a']).toEqual({ value: 'explicit' });
    });

    it('skips migration logic entirely on type mismatch (no MIGRATION_FAILED)', () => {
      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([
        makeNode({ id: 'a', type: 'action', hash: 'hash-v2' }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const typeMismatch = result.issues.find(
        (i) => i.code === 'TYPE_MISMATCH'
      );
      expect(typeMismatch).toBeDefined();

      const migrationFailed = result.issues.find(
        (i) => i.code === 'MIGRATION_FAILED'
      );
      expect(migrationFailed).toBeUndefined();

      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();

      expect(result.reconciledState.values['a']).toBeUndefined();
    });
  });

  describe('valueLineage reconciliation (TDD)', () => {
    it('carries forward valueLineage for surviving nodes', () => {
      const priorView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const newView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const priorData = makeData(
        { a: { value: 'hello' }, b: { value: true } },
        {},
        {
          a: { lastUpdated: 500, lastInteractionId: 'int-1' },
          b: { lastUpdated: 600, lastInteractionId: 'int-2' },
        }
      );

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.valueLineage).toBeDefined();
      expect(result.reconciledState.valueLineage!['a']).toEqual({
        lastUpdated: 500,
        lastInteractionId: 'int-1',
      });
      expect(result.reconciledState.valueLineage!['b']).toEqual({
        lastUpdated: 600,
        lastInteractionId: 'int-2',
      });
    });

    it('drops valueLineage for removed nodes', () => {
      const priorView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData(
        { a: { value: 'hello' }, b: { value: true } },
        {},
        {
          a: { lastUpdated: 500 },
          b: { lastUpdated: 600 },
        }
      );

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.valueLineage?.['a']).toBeDefined();
      expect(result.reconciledState.valueLineage?.['b']).toBeUndefined();
    });

    it('preserves value lineage when hash changes without a strategy', () => {
      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([makeNode({ id: 'a', hash: 'hash-v2' })]);
      const priorData = makeData(
        { a: { value: 'hello' } },
        {},
        { a: { lastUpdated: 500, lastInteractionId: 'int-1' } }
      );

      const result = reconcile(newView, priorView, priorData, {
        clock: () => 4321,
      });

      expect(result.reconciledState.valueLineage?.['a']).toEqual({
        lastUpdated: 500,
        lastInteractionId: 'int-1',
      });
      expect(result.diffs.find((diff) => diff.nodeId === 'a')).toBeUndefined();
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'MIGRATION_FAILED',
          nodeId: 'a',
        })
      );
    });

    it('remaps valueLineage to new id when node matched by key', () => {
      const priorView = makeView([makeNode({ id: 'old-id', key: 'email' })]);
      const newView = makeView([makeNode({ id: 'new-id', key: 'email' })]);
      const priorData = makeData(
        { 'old-id': { value: 'test@example.com' } },
        {},
        { 'old-id': { lastUpdated: 500, lastInteractionId: 'int-1' } }
      );

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.valueLineage?.['new-id']).toEqual({
        lastUpdated: 500,
        lastInteractionId: 'int-1',
      });
      expect(result.reconciledState.valueLineage?.['old-id']).toBeUndefined();
      expect(result.resolutions).toContainEqual(
        expect.objectContaining({
          nodeId: 'new-id',
          priorId: 'old-id',
          matchedBy: 'key',
          resolution: 'carried',
        })
      );
    });
  });

  describe('viewHash population (TDD)', () => {
    it('sets viewHash on reconciled state lineage when nodes have hashes', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView: ViewDefinition = {
        viewId: 'view-1',
        version: '1.0',
        nodes: [makeNode({ id: 'a', hash: 'node-hash-1' })],
      };
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.lineage.viewHash).toBe(
        computeViewHash(newView)
      );

      const repeated = reconcile(newView, priorView, priorData);
      expect(repeated.reconciledState.lineage.viewHash).toBe(
        result.reconciledState.lineage.viewHash
      );
    });

    it('does not set viewHash when no nodes have hashes', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.lineage.viewHash).toBeUndefined();
    });

    it('produces different viewHash values when node order changes', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const viewOrderA = makeView([
        makeNode({ id: 'a', hash: 'hash-alpha' }),
        makeNode({ id: 'b', type: 'action', hash: 'hash-beta' }),
      ]);
      const viewOrderB = makeView([
        makeNode({ id: 'b', type: 'action', hash: 'hash-beta' }),
        makeNode({ id: 'a', hash: 'hash-alpha' }),
      ]);

      const resultA = reconcile(viewOrderA, priorView, priorData);
      const resultB = reconcile(viewOrderB, priorView, priorData);

      expect(resultA.reconciledState.lineage.viewHash).toBeDefined();
      expect(resultA.reconciledState.lineage.viewHash).not.toBe(
        resultB.reconciledState.lineage.viewHash
      );
    });
  });

  describe('determinism invariant (TDD)', () => {
    it('uses injected clock for deterministic timestamps', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const fixedTime = 9999;
      const clock = () => fixedTime;

      const result = reconcile(newView, priorView, priorData, {
        clock,
      });

      expect(result.reconciledState.lineage.timestamp).toBe(fixedTime);
    });
  });

  describe('reconciliation resolutions', () => {
    it('includes a resolution entry for each node in the new view', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.resolutions).toBeDefined();
      expect(result.resolutions).toHaveLength(2);
    });

    it('resolution for carried node with matchedBy id', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const entry = result.resolutions.find((t) => t.nodeId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBe('a');
      expect(entry!.matchedBy).toBe('id');
      expect(entry!.priorType).toBe('field');
      expect(entry!.newType).toBe('field');
      expect(entry!.resolution).toBe('carried');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toEqual({ value: 'hello' });
    });

    it('resolution for added node with null prior info', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([
        makeNode({ id: 'a' }),
        makeNode({ id: 'b', type: 'action' }),
      ]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const entry = result.resolutions.find((t) => t.nodeId === 'b');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBeNull();
      expect(entry!.matchedBy).toBeNull();
      expect(entry!.priorType).toBeNull();
      expect(entry!.newType).toBe('action');
      expect(entry!.resolution).toBe('added');
      expect(entry!.priorValue).toBeUndefined();
      expect(entry!.reconciledValue).toBeUndefined();
    });

    it('resolution for detached node on type mismatch', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a', type: 'action' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const entry = result.resolutions.find((t) => t.nodeId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.resolution).toBe('detached');
      expect(entry!.priorType).toBe('field');
      expect(entry!.newType).toBe('action');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toBeUndefined();
    });

    it('resolution stays carried when hash changes without a strategy', () => {
      const priorView = makeView([makeNode({ id: 'a', hash: 'hash-v1' })]);
      const newView = makeView([makeNode({ id: 'a', hash: 'hash-v2' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      const entry = result.resolutions.find((t) => t.nodeId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.resolution).toBe('carried');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toEqual({ value: 'hello' });
    });

    it('resolution for key-matched node with matchedBy key', () => {
      const priorView = makeView([makeNode({ id: 'old-id', key: 'email' })]);
      const newView = makeView([makeNode({ id: 'new-id', key: 'email' })]);
      const priorData = makeData({ 'old-id': { value: 'test@example.com' } });

      const result = reconcile(newView, priorView, priorData);

      const entry = result.resolutions.find((t) => t.nodeId === 'new-id');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBe('old-id');
      expect(entry!.matchedBy).toBe('key');
      expect(entry!.resolution).toBe('carried');
    });
  });

  describe('output metadata', () => {
    it('updates viewId and viewVersion from new view', () => {
      const priorView = makeView([makeNode({ id: 'a' })], 'old-view', '0.9');
      const newView = makeView([makeNode({ id: 'a' })], 'new-view', '2.0');
      const priorData = makeData(
        { a: { value: 'hello' } },
        { viewId: 'old-view', viewVersion: '0.9' }
      );

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.lineage.viewId).toBe('new-view');
      expect(result.reconciledState.lineage.viewVersion).toBe('2.0');
    });

    it('updates timestamp on reconciled state', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.lineage.timestamp).toBeGreaterThan(
        priorData.lineage.timestamp
      );
    });

    it('preserves sessionId from prior data', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData(
        { a: { value: 'hello' } },
        { sessionId: 'my-session' }
      );

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.lineage.sessionId).toBe('my-session');
    });
  });

  describe('deeply nested children', () => {
    it('carries state for a 3-level deep nested node by id', () => {
      const nested = makeNode({ id: 'deep' });
      const mid = makeNode({ id: 'mid', type: 'group', children: [nested] });
      const root = makeNode({ id: 'root', type: 'group', children: [mid] });

      const priorView = makeView([root]);
      const newView = makeView([root]);
      const priorData = makeData({ 'root/mid/deep': { value: 'buried' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['root/mid/deep']).toEqual({
        value: 'buried',
      });
    });

    it('detects removal of a deeply nested node', () => {
      const nested = makeNode({ id: 'deep' });
      const root = makeNode({ id: 'root', type: 'group', children: [nested] });

      const priorView = makeView([root]);
      const newView = makeView([
        makeNode({ id: 'root', type: 'group', children: [] }),
      ]);
      const priorData = makeData({ 'root/deep': { value: 'gone' } });

      const result = reconcile(newView, priorView, priorData);

      const removedDiff = result.diffs.find((d) => d.nodeId === 'root/deep');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
    });

    it('matches deeply nested node by key across id renames', () => {
      const deepOld = makeNode({ id: 'old-deep', key: 'stable-key' });
      const rootOld = makeNode({
        id: 'root',
        type: 'group',
        children: [deepOld],
      });
      const deepNew = makeNode({ id: 'new-deep', key: 'stable-key' });
      const rootNew = makeNode({
        id: 'root',
        type: 'group',
        children: [deepNew],
      });

      const priorView = makeView([rootOld]);
      const newView = makeView([rootNew]);
      const priorData = makeData({
        'root/old-deep': { value: 'nested-carry' },
      });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['root/new-deep']).toEqual({
        value: 'nested-carry',
      });
    });
  });

  describe('duplicate id/key handling', () => {
    it('last-write-wins when duplicate ids appear in a view', () => {
      const first = makeNode({ id: 'dup' });
      const second = makeNode({ id: 'dup', type: 'action' });

      const priorView = makeView([first]);
      const newView = makeView([first, second]);
      const priorData = makeData({ dup: { value: 'original' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['dup']).toBeUndefined();
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DUPLICATE_NODE_ID',
          nodeId: 'dup',
        })
      );
      expect(result.diffs).toContainEqual(
        expect.objectContaining({
          nodeId: 'dup',
          type: 'type-changed',
          oldValue: { value: 'original' },
        })
      );
      expect(result.resolutions).toEqual([
        expect.objectContaining({
          nodeId: 'dup',
          priorId: 'dup',
          resolution: 'detached',
          newType: 'action',
        }),
      ]);
    });

    it('last-write-wins when duplicate keys appear in a view', () => {
      const priorNode = makeNode({ id: 'old', key: 'same-key' });
      const first = makeNode({ id: 'a', key: 'same-key' });
      const second = makeNode({ id: 'b', key: 'same-key' });

      const priorView = makeView([priorNode]);
      const newView = makeView([first, second]);
      const priorData = makeData({ old: { value: 'original' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['a']).toBeUndefined();
      expect(result.reconciledState.values['b']).toEqual({ value: 'original' });
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DUPLICATE_NODE_KEY',
          nodeId: 'b',
        })
      );
      expect(result.resolutions).toContainEqual(
        expect.objectContaining({
          nodeId: 'a',
          priorId: null,
          matchedBy: null,
          resolution: 'added',
        })
      );
      expect(result.resolutions).toContainEqual(
        expect.objectContaining({
          nodeId: 'b',
          priorId: 'old',
          matchedBy: 'key',
          resolution: 'carried',
        })
      );
    });
  });

  describe('empty view transitions', () => {
    it('handles transition from populated view to empty view', () => {
      const priorView = makeView([makeNode({ id: 'a' })]);
      const newView = makeView([]);
      const priorData = makeData({ a: { value: 'hello' } });

      const result = reconcile(newView, priorView, priorData);

      expect(Object.keys(result.reconciledState.values)).toHaveLength(0);
      const removedDiff = result.diffs.find((d) => d.nodeId === 'a');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
    });

    it('handles transition from empty view to populated view', () => {
      const priorView = makeView([]);
      const newView = makeView([makeNode({ id: 'a' })]);
      const priorData = makeData({});

      const result = reconcile(newView, priorView, priorData);

      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].type).toBe('added');
    });

    it('handles empty-to-empty view transition', () => {
      const priorView = makeView([]);
      const newView = makeView([]);
      const priorData = makeData({});

      const result = reconcile(newView, priorView, priorData);

      expect(result.diffs).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('large node count', () => {
    it('reconciles 500 nodes without error', () => {
      const nodes = Array.from({ length: 500 }, (_, i) =>
        makeNode({ id: `c${i}` })
      );
      const priorView = makeView(nodes, 'big', '1');
      const newView = makeView(nodes, 'big', '2');
      const values: Record<string, NodeValue> = {};
      for (let i = 0; i < 500; i++) {
        values[`c${i}`] = { value: `v${i}` };
      }
      const priorData = makeData(values);

      const result = reconcile(newView, priorView, priorData);

      expect(Object.keys(result.reconciledState.values)).toHaveLength(500);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('detached values', () => {
    it('stores removed node values in detachedValues', () => {
      const priorView = makeView([
        makeNode({ id: 'a', key: 'a-key' }),
        makeNode({ id: 'b', key: 'b-key' }),
      ]);
      const newView = makeView([makeNode({ id: 'a', key: 'a-key' })]);
      const priorData = makeData({
        a: { value: 'keep' },
        b: { value: 'orphan me' },
      });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.detachedValues?.['b-key']).toBeDefined();
      expect(result.reconciledState.detachedValues?.['b-key'].reason).toBe(
        'node-removed'
      );
    });

    it('stores previous label metadata for removed nested fields', () => {
      const priorView = makeView([
        makeNode({
          id: 'employment',
          type: 'group',
          label: 'Employment',
          children: [
            makeNode({
              id: 'employer_name',
              key: 'employer_name',
              label: 'Employer',
            }),
          ],
        }),
      ]);
      const newView = makeView([]);
      const priorData = makeData({
        'employment/employer_name': { value: 'Acme' },
      });

      const result = reconcile(newView, priorView, priorData);

      expect(
        result.reconciledState.detachedValues?.['employer_name'].previousLabel
      ).toBe('Employer');
      expect(
        result.reconciledState.detachedValues?.['employer_name']
          .previousParentLabel
      ).toBe('Employment');
    });

    it('restores detached value when matching key and type return', () => {
      const priorView = makeView([makeNode({ id: 'a', key: 'a-key' })]);
      const removedView = makeView([]);
      const restoreView = makeView([makeNode({ id: 'a2', key: 'a-key' })]);
      const priorData = makeData({
        a: { value: 'hello' },
      });

      const removedResult = reconcile(removedView, priorView, priorData);
      const restoredResult = reconcile(
        restoreView,
        removedView,
        removedResult.reconciledState
      );

      expect(restoredResult.reconciledState.values['a2']).toEqual({
        value: 'hello',
      });
      expect(
        restoredResult.reconciledState.detachedValues?.['a-key']
      ).toBeUndefined();
      expect(
        restoredResult.resolutions.some(
          (entry) => entry.resolution === 'restored'
        )
      ).toBe(true);
      expect(
        restoredResult.diffs.some((diff) => diff.type === 'restored')
      ).toBe(true);
    });

    it('accumulates detached values from multiple pushes and restores them when key returns', () => {
      const viewA = makeView([makeNode({ id: 'a', key: 'email' })]);
      const viewEmpty = makeView([]);
      const viewB = makeView([makeNode({ id: 'b', key: 'phone' })]);
      const viewRestore = makeView([
        makeNode({ id: 'c', key: 'email' }),
        makeNode({ id: 'd', key: 'phone' }),
      ]);
      const dataA = makeData({ a: { value: 'a@example.com' } });

      const r1 = reconcile(viewEmpty, viewA, dataA);
      expect(r1.reconciledState.detachedValues?.['email']).toBeDefined();

      const r2Data: DataSnapshot = {
        ...r1.reconciledState,
        values: { b: { value: '555-1234' } },
      };
      const r2 = reconcile(viewEmpty, viewB, r2Data);
      expect(r2.reconciledState.detachedValues?.['email']).toBeDefined();
      expect(r2.reconciledState.detachedValues?.['phone']).toBeDefined();

      const r3 = reconcile(viewRestore, viewEmpty, r2.reconciledState);

      expect(r3.reconciledState.values['c']).toEqual({
        value: 'a@example.com',
      });
      expect(r3.reconciledState.values['d']).toEqual({ value: '555-1234' });
      expect(r3.reconciledState.detachedValues?.['email']).toBeUndefined();
      expect(r3.reconciledState.detachedValues?.['phone']).toBeUndefined();
    });

    it('keeps the prior value detached when a replacement node does not match exactly', () => {
      const priorView = makeView([
        makeNode({ id: 'old-email', key: 'email', defaultValue: '' }),
      ]);
      const newView = makeView([
        makeNode({
          id: 'new-email',
          key: 'contact.email',
          defaultValue: 'AI default',
        }),
      ]);
      const priorData = makeData({
        'old-email': { value: 'user@example.com', isDirty: true },
      });

      const result = reconcile(newView, priorView, priorData);

      expect(result.reconciledState.values['new-email']).toEqual({
        value: 'AI default',
      });
      expect(result.reconciledState.values['old-email']).toBeUndefined();
      expect(
        result.diffs.find(
          (diff) => diff.nodeId === 'new-email' && diff.type === 'restored'
        )
      ).toBeUndefined();
      expect(result.reconciledState.detachedValues?.['email']).toBeDefined();
    });
  });

  describe('duplicate detection', () => {
    it('detects duplicate node IDs in new view', () => {
      const view = makeView([
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
      ]);

      const result = reconcile(view, null, null);

      expect(result.issues).toHaveLength(2); // NO_PRIOR_DATA + DUPLICATE_NODE_ID
      expect(result.issues[1]).toEqual({
        severity: 'error',
        nodeId: 'duplicate',
        message: 'Duplicate node id: duplicate',
        code: 'DUPLICATE_NODE_ID',
      });
    });

    it('detects duplicate node keys in new view', () => {
      const view = makeView([
        makeNode({
          id: 'a',
          key: 'dup-key',
          type: 'field',
          dataType: 'string',
        }),
        makeNode({
          id: 'b',
          key: 'dup-key',
          type: 'field',
          dataType: 'string',
        }),
      ]);

      const result = reconcile(view, null, null);

      expect(result.issues).toHaveLength(2); // NO_PRIOR_DATA + DUPLICATE_NODE_KEY
      expect(result.issues[1]).toEqual({
        severity: 'warning',
        nodeId: 'b',
        message: 'Duplicate node key: dup-key',
        code: 'DUPLICATE_NODE_KEY',
      });
    });

    it('does not flag duplicate IDs across parent scope boundaries', () => {
      const view = makeView([
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
        makeNode({
          id: 'group',
          type: 'group',
          children: [
            makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
          ],
        }),
      ]);

      const result = reconcile(view, null, null);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_DATA');
    });

    it('does not flag duplicate keys across parent scope boundaries', () => {
      const view = makeView([
        makeNode({
          id: 'a',
          key: 'dup-key',
          type: 'field',
          dataType: 'string',
        }),
        makeNode({
          id: 'group',
          type: 'group',
          children: [
            makeNode({
              id: 'b',
              key: 'dup-key',
              type: 'field',
              dataType: 'string',
            }),
          ],
        }),
      ]);

      const result = reconcile(view, null, null);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_DATA');
    });

    it('preserves last-write-wins behavior for duplicate IDs', () => {
      const view = makeView([
        makeNode({
          id: 'duplicate',
          key: 'stable-key',
          type: 'field',
          dataType: 'string',
          label: 'First',
        }),
        makeNode({
          id: 'duplicate',
          key: 'stable-key',
          type: 'field',
          dataType: 'string',
          label: 'Second',
          defaultValue: 'second',
        }),
      ]);

      const result = reconcile(view, null, null);

      expect(result.reconciledState.values['duplicate']).toEqual({
        value: 'second',
      });
    });

    it('detects duplicates when prior view is missing', () => {
      const view = makeView([
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
      ]);
      const priorData = makeData({ duplicate: { value: 'old' } });

      const result = reconcile(view, null, priorData, {
        allowPriorDataWithoutPriorView: true,
      });

      expect(result.issues.some((i) => i.code === 'DUPLICATE_NODE_ID')).toBe(
        true
      );
      expect(result.issues.some((i) => i.code === 'NO_PRIOR_VIEW')).toBe(true);
    });

    it('detects duplicates in view transition', () => {
      const priorView = makeView([
        makeNode({ id: 'a', type: 'field', dataType: 'string' }),
      ]);
      const newView = makeView([
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
        makeNode({ id: 'duplicate', type: 'field', dataType: 'string' }),
      ]);
      const priorData = makeData({ a: { value: 'old' } });

      const result = reconcile(newView, priorView, priorData);

      expect(result.issues.some((i) => i.code === 'DUPLICATE_NODE_ID')).toBe(
        true
      );
    });
  });
});
