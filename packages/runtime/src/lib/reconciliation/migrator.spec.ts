import { describe, it, expect, vi } from 'vitest';
import type { ComponentDefinition } from '@continuum/contract';
import type { MigrationStrategy } from '../types.js';
import { attemptMigration } from './migrator.js';

function makeComponent(
  overrides: Partial<ComponentDefinition> & { id: string; type: string }
): ComponentDefinition {
  return { ...overrides };
}

describe('attemptMigration', () => {
  it('uses explicit migrationStrategies when provided', () => {
    const strategy: MigrationStrategy = vi.fn((_id, _old, _new, state) => {
      return { value: (state as { value: string }).value.toUpperCase() };
    });

    const result = attemptMigration(
      'comp-1',
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v1' }),
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v2' }),
      { value: 'hello' },
      { migrationStrategies: { 'comp-1': strategy } }
    );

    expect(strategy).toHaveBeenCalledOnce();
    expect(result).toEqual({ value: 'HELLO' });
  });

  it('uses schema-declared migration rule with strategyRegistry', () => {
    const registry: MigrationStrategy = vi.fn(() => ({ value: 'migrated' }));

    const result = attemptMigration(
      'comp-1',
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v1' }),
      makeComponent({
        id: 'comp-1',
        type: 'input',
        hash: 'v2',
        migrations: [{ fromHash: 'v1', toHash: 'v2', strategyId: 'my-strategy' }],
      }),
      { value: 'hello' },
      { strategyRegistry: { 'my-strategy': registry } }
    );

    expect(registry).toHaveBeenCalledOnce();
    expect(result).toEqual({ value: 'migrated' });
  });

  it('falls back to passthrough when types match and no strategy exists', () => {
    const result = attemptMigration(
      'comp-1',
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v1' }),
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v2' }),
      { value: 'hello' },
      {}
    );

    expect(result).toEqual({ value: 'hello' });
  });

  it('returns null when types differ and no strategy exists', () => {
    const result = attemptMigration(
      'comp-1',
      makeComponent({ id: 'comp-1', type: 'input', hash: 'v1' }),
      makeComponent({ id: 'comp-1', type: 'toggle', hash: 'v2' }),
      { value: 'hello' },
      {}
    );

    expect(result).toBeNull();
  });
});
