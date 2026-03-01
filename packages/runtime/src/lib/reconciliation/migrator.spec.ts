import { describe, it, expect, vi } from 'vitest';
import type { ViewNode } from '@continuum/contract';
import type { MigrationStrategy } from '../types.js';
import { attemptMigration } from './migrator.js';

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
    ...(type === 'group' ? { children: [] } : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...overrides,
  } as ViewNode;
}

describe('attemptMigration', () => {
  it('uses explicit migrationStrategies when provided', () => {
    const strategy: MigrationStrategy = vi.fn((_id, _old, _new, state) => {
      return { value: (state as { value: string }).value.toUpperCase() };
    });

    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      { value: 'hello' },
      { migrationStrategies: { 'node-1': strategy } }
    );

    expect(strategy).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'migrated', value: { value: 'HELLO' } });
  });

  it('uses view-declared migration rule with strategyRegistry', () => {
    const registry: MigrationStrategy = vi.fn(() => ({ value: 'migrated' }));

    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({
        id: 'node-1',
        type: 'field',
        hash: 'v2',
        migrations: [{ fromHash: 'v1', toHash: 'v2', strategyId: 'my-strategy' }],
      }),
      { value: 'hello' },
      { strategyRegistry: { 'my-strategy': registry } }
    );

    expect(registry).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'migrated', value: { value: 'migrated' } });
  });

  it('falls back to passthrough when types match and no strategy exists', () => {
    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      { value: 'hello' },
      {}
    );

    expect(result).toEqual({ kind: 'migrated', value: { value: 'hello' } });
  });

  it('returns no migration when types differ and no strategy exists', () => {
    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'action', hash: 'v2' }),
      { value: 'hello' },
      {}
    );

    expect(result).toEqual({ kind: 'none' });
  });
});
