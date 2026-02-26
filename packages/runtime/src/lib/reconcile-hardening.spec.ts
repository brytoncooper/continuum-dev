import type { SchemaSnapshot, StateSnapshot } from '@continuum/contract';
import { ISSUE_CODES } from '@continuum/contract';
import { describe, expect, it } from 'vitest';
import { buildPriorValueLookupByIdAndKey, buildReconciliationContext } from './context.js';
import { reconcile } from './reconcile.js';
import { computeSchemaHash } from './reconciliation/state-builder.js';

const priorSchema: SchemaSnapshot = {
  schemaId: 'schema',
  version: '1',
  components: [{ id: 'a', key: 'k', type: 'input', hash: 'h1' }],
};

const priorState: StateSnapshot = {
  values: { a: { value: 'old' } },
  meta: { timestamp: 1, sessionId: 's' },
};

describe('runtime hardening', () => {
  it('treats null as a valid migrated value', () => {
    const nextSchema: SchemaSnapshot = {
      schemaId: 'schema',
      version: '2',
      components: [{ id: 'a', key: 'k', type: 'input', hash: 'h2' }],
    };

    const result = reconcile(nextSchema, priorSchema, priorState, {
      migrationStrategies: { a: () => null },
    });

    expect(result.reconciledState.values.a).toBeNull();
    expect(result.issues.some((issue) => issue.code === ISSUE_CODES.MIGRATION_FAILED)).toBe(false);
    expect(result.diffs[0]).toEqual({
      componentId: 'a',
      type: 'migrated',
      oldValue: { value: 'old' },
      newValue: null,
      reason: 'Component schema changed, migration applied',
    });
  });

  it('captures migration strategy errors as MIGRATION_FAILED and carries prior value', () => {
    const nextSchema: SchemaSnapshot = {
      schemaId: 'schema',
      version: '2',
      components: [{ id: 'a', key: 'k', type: 'input', hash: 'h2' }],
    };

    const result = reconcile(nextSchema, priorSchema, priorState, {
      migrationStrategies: { a: () => { throw new Error('boom'); } },
    });

    expect(result.reconciledState.values.a).toEqual({ value: 'old' });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: ISSUE_CODES.MIGRATION_FAILED,
        severity: 'warning',
      })
    );
  });

  it('uses a schema hash format without separator collisions', () => {
    const one: SchemaSnapshot = {
      schemaId: 'schema',
      version: '1',
      components: [{ id: 'a', type: 'input', hash: 'a:b' }],
    };
    const two: SchemaSnapshot = {
      schemaId: 'schema',
      version: '1',
      components: [
        { id: 'a', type: 'input', hash: 'a' },
        { id: 'b', type: 'input', hash: 'b' },
      ],
    };

    expect(computeSchemaHash(one)).not.toBe(computeSchemaHash(two));
  });

  it('buildPriorValueLookupByIdAndKey resolves nested key matches to new ids', () => {
    const previous: SchemaSnapshot = {
      schemaId: 'schema',
      version: '1',
      components: [
        { id: 'root', type: 'container', children: [{ id: 'old-child', key: 'child-key', type: 'input' }] },
      ],
    };
    const next: SchemaSnapshot = {
      schemaId: 'schema',
      version: '2',
      components: [
        { id: 'root', type: 'container', children: [{ id: 'new-child', key: 'child-key', type: 'input' }] },
      ],
    };
    const context = buildReconciliationContext(next, previous);
    const state: StateSnapshot = {
      values: { 'old-child': { value: 'nested' } },
      meta: { timestamp: 0, sessionId: 's' },
    };

    const lookup = buildPriorValueLookupByIdAndKey(state, context);
    expect(lookup.get('new-child')).toEqual({ value: 'nested' });
  });

  it('handles empty schemas without producing invalid arrays', () => {
    const next: SchemaSnapshot = { schemaId: 'schema', version: '2', components: [] };
    const result = reconcile(next, priorSchema, priorState);
    expect(result.reconciledState.values).toEqual({});
    expect(Array.isArray(result.diffs)).toBe(true);
    expect(Array.isArray(result.trace)).toBe(true);
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
