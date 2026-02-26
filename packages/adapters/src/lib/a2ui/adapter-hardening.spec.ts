import type { ComponentState, SchemaSnapshot } from '@continuum/contract';
import { describe, expect, it } from 'vitest';
import { a2uiAdapter, createDefaultStateForComponentType } from './adapter.js';

describe('a2ui adapter hardening', () => {
  it('exports a stable adapter name', () => {
    expect(a2uiAdapter.name).toBe('a2ui');
  });

  it('handles missing fields array in toSchema', () => {
    const schema = a2uiAdapter.toSchema({
      id: 'form',
      version: '1',
      fields: undefined as unknown as [],
    });
    expect(schema.components).toEqual([]);
  });

  it('handles non-string field type when generating ids', () => {
    const schema = a2uiAdapter.toSchema({
      id: 'form',
      version: '1',
      fields: [{ type: undefined as unknown as string }],
    });
    expect(schema.components[0].id).toBe('default_1');
    expect(schema.components[0].type).toBe('default');
  });

  it('handles null values in fromState', () => {
    const state = {
      a: null,
      b: { value: 'x' } as ComponentState,
    } as unknown as Record<string, ComponentState>;
    const external = a2uiAdapter.fromState(state);
    expect(external.a).toBeNull();
    expect(external.b).toBe('x');
  });

  it('normalizes array values to strings in toState', () => {
    const state = a2uiAdapter.toState({ ids: [1, '2', true] });
    expect(state.ids).toEqual({ selectedIds: ['1', '2', 'true'] });
  });

  it('provides explicit default state for container type', () => {
    expect(createDefaultStateForComponentType('container')).toEqual({});
  });

  it('round-trips unknown schema component types through default mapping', () => {
    const schema: SchemaSnapshot = {
      schemaId: 'schema',
      version: '1',
      components: [{ id: 'x', type: 'unknown' }],
    };
    const form = a2uiAdapter.fromSchema(schema);
    expect(form.fields[0].type).toBe('TextInput');
  });
});
