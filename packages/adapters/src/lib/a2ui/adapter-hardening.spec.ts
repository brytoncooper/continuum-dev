import type {
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import { a2uiAdapter, createDefaultNodeValue } from './adapter.js';

describe('a2ui adapter hardening', () => {
  it('exports a stable adapter name', () => {
    expect(a2uiAdapter.name).toBe('a2ui');
  });

  it('handles missing fields array in toView', () => {
    const view = a2uiAdapter.toView({
      id: 'form',
      version: '1',
      fields: undefined as unknown as [],
    });
    expect(view.nodes).toEqual([]);
  });

  it('handles non-string field type when generating ids', () => {
    const view = a2uiAdapter.toView({
      id: 'form',
      version: '1',
      fields: [{ type: undefined as unknown as string }],
    });
    expect(view.nodes[0].id).toBe('default_1');
    expect(view.nodes[0]).toMatchObject({ type: 'field', dataType: 'string' });
  });

  it('handles null values in fromState', () => {
    const state = {
      a: null,
      b: { value: 'x' } as NodeValue,
    } as unknown as Record<string, NodeValue>;
    const external = a2uiAdapter.fromState!(state);
    expect(external.a).toBeNull();
    expect(external.b).toBe('x');
  });

  it('wraps array values in NodeValue', () => {
    const state = a2uiAdapter.toState!({ ids: [1, '2', true] });
    expect(state.ids).toEqual({ value: [1, '2', true] });
  });

  it('provides default NodeValue for number dataType', () => {
    expect(createDefaultNodeValue('number')).toEqual({ value: 0 });
  });

  it('round-trips unknown view node types through default mapping', () => {
    const definition: ViewDefinition = {
      viewId: 'view',
      version: '1',
      nodes: [{ id: 'x', type: 'unknown' } as unknown as ViewNode],
    };
    const form = a2uiAdapter.fromView!(definition);
    expect(form.fields[0].type).toBe('TextInput');
  });
});
