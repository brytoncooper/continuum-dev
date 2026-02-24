import { describe, it, expect } from 'vitest';
import type { ComponentDefinition, SchemaSnapshot, StateSnapshot, ComponentState } from '@continuum/contract';
import { buildReconciliationContext, buildPriorValueMap } from '../context.js';
import { resolveAllComponents, detectRemovedComponents } from './component-resolver.js';

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
  meta?: Partial<StateSnapshot['meta']>
): StateSnapshot {
  return {
    values,
    meta: { timestamp: 1000, sessionId: 'test-session', ...meta },
  };
}

describe('resolveAllComponents', () => {
  it('marks new components as added', () => {
    const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const newSchema = makeSchema([
      makeComponent({ id: 'a', type: 'input' }),
      makeComponent({ id: 'b', type: 'toggle' }),
    ]);
    const priorState = makeState({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const priorValues = buildPriorValueMap(priorState, ctx);

    const result = resolveAllComponents(ctx, priorValues, priorState, 5000, {});

    const addedDiff = result.diffs.find((d) => d.componentId === 'b');
    expect(addedDiff).toBeDefined();
    expect(addedDiff!.type).toBe('added');
  });

  it('carries state for id-matched components', () => {
    const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const priorState = makeState({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(schema, schema);
    const priorValues = buildPriorValueMap(priorState, ctx);

    const result = resolveAllComponents(ctx, priorValues, priorState, 5000, {});

    expect(result.values['a']).toEqual({ value: 'hello' });
    expect(result.trace[0].action).toBe('carried');
    expect(result.trace[0].matchedBy).toBe('id');
  });

  it('carries state for key-matched components when id changes', () => {
    const priorSchema = makeSchema([makeComponent({ id: 'old', type: 'input', key: 'email' })]);
    const newSchema = makeSchema([makeComponent({ id: 'new', type: 'input', key: 'email' })]);
    const priorState = makeState({ old: { value: 'test@example.com' } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const priorValues = buildPriorValueMap(priorState, ctx);

    const result = resolveAllComponents(ctx, priorValues, priorState, 5000, {});

    expect(result.values['new']).toEqual({ value: 'test@example.com' });
    expect(result.trace[0].matchedBy).toBe('key');
  });

  it('drops state and issues TYPE_MISMATCH on type change', () => {
    const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const newSchema = makeSchema([makeComponent({ id: 'a', type: 'toggle' })]);
    const priorState = makeState({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const priorValues = buildPriorValueMap(priorState, ctx);

    const result = resolveAllComponents(ctx, priorValues, priorState, 5000, {});

    expect(result.values['a']).toBeUndefined();
    expect(result.issues[0].code).toBe('TYPE_MISMATCH');
    expect(result.trace[0].action).toBe('dropped');
  });

  it('migrates state when hash changes and same type', () => {
    const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input', hash: 'v1' })]);
    const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input', hash: 'v2' })]);
    const priorState = makeState({ a: { value: 'hello' } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const priorValues = buildPriorValueMap(priorState, ctx);

    const result = resolveAllComponents(ctx, priorValues, priorState, 5000, {});

    expect(result.values['a']).toEqual({ value: 'hello' });
    expect(result.diffs[0].type).toBe('migrated');
    expect(result.trace[0].action).toBe('migrated');
  });
});

describe('detectRemovedComponents', () => {
  it('detects components that no longer exist in the new schema', () => {
    const priorSchema = makeSchema([
      makeComponent({ id: 'a', type: 'input' }),
      makeComponent({ id: 'b', type: 'toggle' }),
    ]);
    const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const priorState = makeState({ a: { value: 'hello' }, b: { checked: true } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);

    const result = detectRemovedComponents(ctx, priorState, {});

    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].componentId).toBe('b');
    expect(result.diffs[0].type).toBe('removed');
    expect(result.issues[0].code).toBe('COMPONENT_REMOVED');
  });

  it('suppresses COMPONENT_REMOVED issue when allowPartialRestore is true', () => {
    const priorSchema = makeSchema([
      makeComponent({ id: 'a', type: 'input' }),
      makeComponent({ id: 'b', type: 'toggle' }),
    ]);
    const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
    const priorState = makeState({ a: { value: 'hello' }, b: { checked: true } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);

    const result = detectRemovedComponents(ctx, priorState, { allowPartialRestore: true });

    expect(result.diffs).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it('does not flag key-matched components as removed', () => {
    const priorSchema = makeSchema([makeComponent({ id: 'old', type: 'input', key: 'email' })]);
    const newSchema = makeSchema([makeComponent({ id: 'new', type: 'input', key: 'email' })]);
    const priorState = makeState({ old: { value: 'hello' } });
    const ctx = buildReconciliationContext(newSchema, priorSchema);

    const result = detectRemovedComponents(ctx, priorState, {});

    expect(result.diffs).toHaveLength(0);
  });
});
