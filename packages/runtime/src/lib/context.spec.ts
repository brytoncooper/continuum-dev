import { describe, it, expect } from 'vitest';
import type { SchemaSnapshot, ComponentDefinition } from '@continuum/contract';
import { buildReconciliationContext, findPriorComponent } from './context.js';

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

describe('buildReconciliationContext', () => {
  it('indexes flat components by id', () => {
    const schema = makeSchema([
      makeComponent({ id: 'a', type: 'input' }),
      makeComponent({ id: 'b', type: 'toggle' }),
    ]);

    const ctx = buildReconciliationContext(schema, null);

    expect(ctx.newById.size).toBe(2);
    expect(ctx.newById.get('a')?.type).toBe('input');
    expect(ctx.newById.get('b')?.type).toBe('toggle');
  });

  it('indexes components by key when present', () => {
    const schema = makeSchema([
      makeComponent({ id: 'a', type: 'input', key: 'email-field' }),
    ]);

    const ctx = buildReconciliationContext(schema, null);

    expect(ctx.newByKey.get('email-field')?.id).toBe('a');
  });

  it('indexes nested children recursively', () => {
    const schema = makeSchema([
      makeComponent({
        id: 'parent',
        type: 'container',
        children: [
          makeComponent({
            id: 'child',
            type: 'input',
            children: [
              makeComponent({ id: 'grandchild', type: 'toggle' }),
            ],
          }),
        ],
      }),
    ]);

    const ctx = buildReconciliationContext(schema, null);

    expect(ctx.newById.size).toBe(3);
    expect(ctx.newById.has('parent')).toBe(true);
    expect(ctx.newById.has('child')).toBe(true);
    expect(ctx.newById.has('grandchild')).toBe(true);
  });

  it('handles null prior schema with empty maps', () => {
    const schema = makeSchema([
      makeComponent({ id: 'a', type: 'input' }),
    ]);

    const ctx = buildReconciliationContext(schema, null);

    expect(ctx.priorById.size).toBe(0);
    expect(ctx.priorByKey.size).toBe(0);
  });
});

describe('findPriorComponent', () => {
  it('matches by id first', () => {
    const newSchema = makeSchema([
      makeComponent({ id: 'comp-1', type: 'input', key: 'email' }),
    ]);
    const priorSchema = makeSchema([
      makeComponent({ id: 'comp-1', type: 'input', key: 'different-key' }),
    ]);

    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const result = findPriorComponent(ctx, ctx.newById.get('comp-1')!);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('comp-1');
  });

  it('falls back to key when id does not match', () => {
    const newSchema = makeSchema([
      makeComponent({ id: 'new-id', type: 'input', key: 'email' }),
    ]);
    const priorSchema = makeSchema([
      makeComponent({ id: 'old-id', type: 'input', key: 'email' }),
    ]);

    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const result = findPriorComponent(ctx, ctx.newById.get('new-id')!);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('old-id');
    expect(result!.key).toBe('email');
  });

  it('returns null when no match exists', () => {
    const newSchema = makeSchema([
      makeComponent({ id: 'new-id', type: 'input' }),
    ]);
    const priorSchema = makeSchema([
      makeComponent({ id: 'other-id', type: 'toggle' }),
    ]);

    const ctx = buildReconciliationContext(newSchema, priorSchema);
    const result = findPriorComponent(ctx, ctx.newById.get('new-id')!);

    expect(result).toBeNull();
  });
});
