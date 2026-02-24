import { describe, it, expect } from 'vitest';
import type { ComponentDefinition, SchemaSnapshot, StateSnapshot, ComponentState } from '@continuum/contract';
import {
  buildFreshSessionResult,
  buildBlindCarryResult,
  assembleReconciliationResult,
  carryValuesMeta,
  computeSchemaHash,
  generateSessionId,
} from './state-builder.js';

function makeSchema(
  components: ComponentDefinition[],
  id = 'schema-1',
  version = '1.0'
): SchemaSnapshot {
  return { schemaId: id, version, components };
}

function makeComponent(
  overrides: Partial<ComponentDefinition> & { id: string; type: string }
): ComponentDefinition {
  return { ...overrides };
}

function makeState(
  values: Record<string, ComponentState>,
  meta?: Partial<StateSnapshot['meta']>,
  valuesMeta?: StateSnapshot['valuesMeta']
): StateSnapshot {
  return {
    values,
    meta: { timestamp: 1000, sessionId: 'test-session', ...meta },
    valuesMeta,
  };
}

describe('buildFreshSessionResult', () => {
  it('returns empty values with a new session id', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const result = buildFreshSessionResult(schema, 5000);

    expect(result.reconciledState.values).toEqual({});
    expect(result.reconciledState.meta.sessionId).toContain('session_');
    expect(result.reconciledState.meta.timestamp).toBe(5000);
  });

  it('generates added diffs for all components including children', () => {
    const schema = makeSchema([
      makeComponent({
        id: 'parent',
        type: 'container',
        children: [makeComponent({ id: 'child', type: 'input' })],
      }),
    ]);
    const result = buildFreshSessionResult(schema, 5000);

    expect(result.diffs).toHaveLength(2);
    expect(result.diffs[0].componentId).toBe('parent');
    expect(result.diffs[1].componentId).toBe('child');
  });

  it('emits NO_PRIOR_STATE info issue', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const result = buildFreshSessionResult(schema, 5000);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe('NO_PRIOR_STATE');
  });
});

describe('buildBlindCarryResult', () => {
  it('drops all values when allowBlindCarry is false', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const state = makeState({ a: { value: 'hello' } });
    const result = buildBlindCarryResult(schema, state, 5000, {});

    expect(result.reconciledState.values).toEqual({});
    expect(result.issues[0].code).toBe('NO_PRIOR_SCHEMA');
  });

  it('carries matching values when allowBlindCarry is true', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const state = makeState({ a: { value: 'hello' }, orphan: { value: 'gone' } });
    const result = buildBlindCarryResult(schema, state, 5000, { allowBlindCarry: true });

    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    expect(result.reconciledState.values['orphan']).toBeUndefined();
  });
});

describe('assembleReconciliationResult', () => {
  it('merges resolved and removal outputs into a single result', () => {
    const resolved = {
      values: { a: { value: 'hello' } as ComponentState },
      valuesMeta: {},
      diffs: [{ componentId: 'a', type: 'added' as const }],
      trace: [],
      issues: [],
    };
    const removals = {
      diffs: [{ componentId: 'b', type: 'removed' as const, oldValue: { checked: true } }],
      issues: [{ severity: 'warning' as const, componentId: 'b', message: 'removed', code: 'COMPONENT_REMOVED' }],
    };
    const priorState = makeState({ b: { checked: true } });
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);

    const result = assembleReconciliationResult(resolved, removals, priorState, schema, 5000);

    expect(result.diffs).toHaveLength(2);
    expect(result.issues).toHaveLength(1);
    expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
  });
});

describe('carryValuesMeta', () => {
  it('copies prior meta to the new id', () => {
    const target: Record<string, { lastUpdated?: number; lastInteractionId?: string }> = {};
    const state = makeState({}, {}, { 'old-id': { lastUpdated: 500, lastInteractionId: 'int-1' } });

    carryValuesMeta(target, 'new-id', 'old-id', state, 9000, false);

    expect(target['new-id']).toEqual({ lastUpdated: 500, lastInteractionId: 'int-1' });
  });

  it('updates lastUpdated when migrated', () => {
    const target: Record<string, { lastUpdated?: number; lastInteractionId?: string }> = {};
    const state = makeState({}, {}, { 'a': { lastUpdated: 500 } });

    carryValuesMeta(target, 'a', 'a', state, 9000, true);

    expect(target['a'].lastUpdated).toBe(9000);
  });
});

describe('computeSchemaHash', () => {
  it('returns undefined when no components have hashes', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    expect(computeSchemaHash(schema)).toBeUndefined();
  });

  it('produces a deterministic hash from sorted component hashes', () => {
    const schemaA = makeSchema([
      makeComponent({ id: 'a', type: 'input', hash: 'alpha' }),
      makeComponent({ id: 'b', type: 'toggle', hash: 'beta' }),
    ]);
    const schemaB = makeSchema([
      makeComponent({ id: 'b', type: 'toggle', hash: 'beta' }),
      makeComponent({ id: 'a', type: 'input', hash: 'alpha' }),
    ]);

    expect(computeSchemaHash(schemaA)).toBe(computeSchemaHash(schemaB));
  });
});

describe('generateSessionId', () => {
  it('includes the timestamp in the id', () => {
    const id = generateSessionId(12345);
    expect(id).toContain('12345');
    expect(id).toMatch(/^session_/);
  });
});
