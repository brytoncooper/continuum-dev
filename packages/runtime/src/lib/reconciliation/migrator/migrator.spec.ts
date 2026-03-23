import { describe, it, expect, vi } from 'vitest';
import type { ViewNode } from '@continuum-dev/contract';
import type { MigrationStrategy } from '../../types.js';
import { attemptMigration } from './index.js';

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
  it('accepts object input with context-style explicit strategies', () => {
    const strategy: MigrationStrategy = vi.fn(({ priorValue }) => {
      return { value: (priorValue as { value: string }).value.toUpperCase() };
    });

    const result = attemptMigration({
      nodeId: 'node-1',
      priorNode: makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      newNode: makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      priorValue: { value: 'hello' },
      options: { migrationStrategies: { 'node-1': strategy } },
    });

    expect(strategy).toHaveBeenCalledOnce();
    expect(strategy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      priorNode: makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      newNode: makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      priorValue: { value: 'hello' },
    });
    expect(result).toEqual({ kind: 'migrated', value: { value: 'HELLO' } });
  });

  it('uses explicit migrationStrategies when provided', () => {
    const strategy: MigrationStrategy = vi.fn(({ priorValue }) => {
      return { value: (priorValue as { value: string }).value.toUpperCase() };
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

  it('preserves legacy explicit strategies that only consume nodeId', () => {
    const strategy = vi.fn((nodeId: string) => ({
      value: nodeId.toUpperCase(),
    })) as unknown as MigrationStrategy;

    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      { value: 'hello' },
      { migrationStrategies: { 'node-1': strategy } }
    );

    expect(strategy).toHaveBeenCalledWith(
      'node-1',
      expect.anything(),
      expect.anything(),
      {
        value: 'hello',
      }
    );
    expect(result).toEqual({ kind: 'migrated', value: { value: 'NODE-1' } });
  });

  it('treats single-identifier context callbacks as context style when they read context properties', () => {
    const strategy = vi.fn((context: { priorValue: { value: string } }) => ({
      value: context.priorValue.value.toUpperCase(),
    })) as unknown as MigrationStrategy;

    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      { value: 'hello' },
      { migrationStrategies: { 'node-1': strategy } }
    );

    expect(strategy).toHaveBeenCalledWith({
      nodeId: 'node-1',
      priorNode: makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      newNode: makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      priorValue: { value: 'hello' },
    });
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
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'my-strategy' },
        ],
      }),
      { value: 'hello' },
      { strategyRegistry: { 'my-strategy': registry } }
    );

    expect(registry).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'migrated', value: { value: 'migrated' } });
  });

  it('preserves legacy positional registry strategies', () => {
    const registry = vi.fn(
      (
        nodeId: string,
        priorNode: ViewNode,
        newNode: ViewNode,
        priorValue: { value: string }
      ) => ({
        value: `${nodeId}:${priorNode.hash}->${newNode.hash}:${priorValue.value}`,
      })
    ) as unknown as MigrationStrategy;

    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({
        id: 'node-1',
        type: 'field',
        hash: 'v2',
        migrations: [
          { fromHash: 'v1', toHash: 'v2', strategyId: 'legacy-strategy' },
        ],
      }),
      { value: 'hello' },
      { strategyRegistry: { 'legacy-strategy': registry } }
    );

    expect(registry).toHaveBeenCalledWith(
      'node-1',
      expect.objectContaining({ hash: 'v1' }),
      expect.objectContaining({ hash: 'v2' }),
      { value: 'hello' }
    );
    expect(result).toEqual({
      kind: 'migrated',
      value: { value: 'node-1:v1->v2:hello' },
    });
  });

  it('returns none when types match and no strategy exists', () => {
    const result = attemptMigration(
      'node-1',
      makeNode({ id: 'node-1', type: 'field', hash: 'v1' }),
      makeNode({ id: 'node-1', type: 'field', hash: 'v2' }),
      { value: 'hello' },
      {}
    );

    expect(result).toEqual({ kind: 'none' });
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
