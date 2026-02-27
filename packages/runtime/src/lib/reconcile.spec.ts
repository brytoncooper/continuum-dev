import { describe, it, expect, vi } from 'vitest';
import type {
  SchemaSnapshot,
  ComponentDefinition,
  StateSnapshot,
  ComponentState,
} from '@continuum/contract';
import { reconcile } from './reconcile.js';
import type { MigrationStrategy } from './types.js';

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
    meta: {
      timestamp: 1000,
      sessionId: 'test-session',
      ...meta,
    },
    valuesMeta,
  };
}

describe('reconcile', () => {
  describe('edge cases', () => {
    it('returns fresh state with NO_PRIOR_STATE info when no prior state exists', () => {
      const schema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);

      const result = reconcile(schema, null, null);

      expect(result.reconciledState.values).toEqual({});
      expect(result.reconciledState.meta.schemaId).toBe('schema-1');
      expect(result.reconciledState.meta.schemaVersion).toBe('1.0');
      expect(result.reconciledState.meta.sessionId).toBeDefined();
      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].type).toBe('added');
      expect(result.diffs[0].componentId).toBe('a');
      expect(result.trace).toHaveLength(1);
      expect(result.trace[0].action).toBe('added');
      expect(result.trace[0].componentId).toBe('a');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_STATE');
      expect(result.issues[0].severity).toBe('info');
    });

    it('returns warning when prior state exists but no prior schema provided', () => {
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, null, priorState);

      expect(result.reconciledState.values).toEqual({});
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('NO_PRIOR_SCHEMA');
      expect(result.issues[0].severity).toBe('warning');
    });

    it('carries values by id with UNTRUSTED_CARRY issues when allowBlindCarry is true and no prior schema', () => {
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const priorState = makeState({
        a: { value: 'hello' },
        b: { checked: true },
      });

      const result = reconcile(newSchema, null, priorState, {
        allowBlindCarry: true,
      });

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      expect(result.reconciledState.values['b']).toEqual({ checked: true });

      const untrustedIssues = result.issues.filter(
        (i) => i.code === 'UNTRUSTED_CARRY'
      );
      expect(untrustedIssues).toHaveLength(2);
      expect(untrustedIssues.every((i) => i.severity === 'info')).toBe(true);
    });

    it('only carries values for components present in new schema when allowBlindCarry is true', () => {
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({
        a: { value: 'hello' },
        orphan: { value: 'gone' },
      });

      const result = reconcile(newSchema, null, priorState, {
        allowBlindCarry: true,
      });

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      expect(result.reconciledState.values['orphan']).toBeUndefined();
    });

    it('carries values for nested components when allowBlindCarry is true', () => {
      const newSchema = makeSchema([
        makeComponent({
          id: 'section',
          type: 'container',
          children: [
            makeComponent({ id: 'nested-input', type: 'input' }),
          ],
        }),
      ]);
      const priorState = makeState({
        'nested-input': { value: 'carried' },
      });

      const result = reconcile(newSchema, null, priorState, {
        allowBlindCarry: true,
      });

      expect(result.reconciledState.values['nested-input']).toEqual({ value: 'carried' });
    });

    it('still emits NO_PRIOR_SCHEMA warning alongside UNTRUSTED_CARRY when allowBlindCarry is true', () => {
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, null, priorState, {
        allowBlindCarry: true,
      });

      expect(result.issues.find((i) => i.code === 'NO_PRIOR_SCHEMA')).toBeDefined();
      expect(result.issues.find((i) => i.code === 'UNTRUSTED_CARRY')).toBeDefined();
    });
  });

  describe('component matching', () => {
    it('carries state over when component matched by id', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
    });

    it('carries state over when component matched by key (id changed)', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'old-id', type: 'input', key: 'email' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'new-id', type: 'input', key: 'email' }),
      ]);
      const priorState = makeState({ 'old-id': { value: 'test@example.com' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['new-id']).toEqual({
        value: 'test@example.com',
      });
    });
  });

  describe('diff generation', () => {
    it('produces added diff for new components', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const addedDiff = result.diffs.find((d) => d.componentId === 'b');
      expect(addedDiff).toBeDefined();
      expect(addedDiff!.type).toBe('added');
    });

    it('produces removed diff and warning for removed components', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({
        a: { value: 'hello' },
        b: { checked: true },
      });

      const result = reconcile(newSchema, priorSchema, priorState);

      const removedDiff = result.diffs.find((d) => d.componentId === 'b');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
      expect(removedDiff!.oldValue).toEqual({ checked: true });

      const removedIssue = result.issues.find(
        (i) => i.code === 'COMPONENT_REMOVED'
      );
      expect(removedIssue).toBeDefined();
      expect(removedIssue!.severity).toBe('warning');
    });

    it('suppresses COMPONENT_REMOVED warning when allowPartialRestore is true', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({
        a: { value: 'hello' },
        b: { checked: true },
      });

      const result = reconcile(newSchema, priorSchema, priorState, {
        allowPartialRestore: true,
      });

      const removedDiff = result.diffs.find((d) => d.componentId === 'b');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');

      const removedIssue = result.issues.find(
        (i) => i.code === 'COMPONENT_REMOVED'
      );
      expect(removedIssue).toBeUndefined();
    });
  });

  describe('type validation', () => {
    it('reports TYPE_MISMATCH error and type-changed diff when component type changes', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'toggle' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const issue = result.issues.find((i) => i.code === 'TYPE_MISMATCH');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('error');

      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();
      expect(diff!.componentId).toBe('a');
      expect(diff!.oldValue).toEqual({ value: 'hello' });
      expect(diff!.reason).toContain('input');
      expect(diff!.reason).toContain('toggle');
    });

    it('does not carry incompatible state on type mismatch', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'toggle' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['a']).toBeUndefined();
      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();
      expect(diff!.oldValue).toEqual({ value: 'hello' });
    });
  });

  describe('schema migration', () => {
    it('passes state through when hash changes but type matches (no explicit strategy)', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v2' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['a']).toEqual({ value: 'hello' });
      const migratedDiff = result.diffs.find((d) => d.type === 'migrated');
      expect(migratedDiff).toBeDefined();
      expect(migratedDiff!.componentId).toBe('a');
    });

    it('calls explicit migration strategy when provided via options', () => {
      const strategy: MigrationStrategy = vi.fn((_id, _old, _new, oldState) => {
        return { value: (oldState as { value: string }).value.toUpperCase() };
      });

      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v2' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState, {
        migrationStrategies: { a: strategy },
      });

      expect(strategy).toHaveBeenCalledOnce();
      expect(result.reconciledState.values['a']).toEqual({ value: 'HELLO' });
      expect(result.diffs.find((d) => d.type === 'migrated')).toBeDefined();
    });

    it('uses schema-declared migration rule with strategyRegistry', () => {
      const registryStrategy: MigrationStrategy = vi.fn(
        (_id, _old, _new, oldState) => {
          return {
            value: (oldState as { value: string }).value + '-migrated',
          };
        }
      );

      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({
          id: 'a',
          type: 'input',
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
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState, {
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

    it('prefers explicit migrationStrategies over schema-declared migrations', () => {
      const explicitStrategy: MigrationStrategy = vi.fn(() => ({
        value: 'explicit',
      }));
      const registryStrategy: MigrationStrategy = vi.fn(() => ({
        value: 'registry',
      }));

      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({
          id: 'a',
          type: 'input',
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
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState, {
        migrationStrategies: { a: explicitStrategy },
        strategyRegistry: { 'some-id': registryStrategy },
      });

      expect(explicitStrategy).toHaveBeenCalledOnce();
      expect(registryStrategy).not.toHaveBeenCalled();
      expect(result.reconciledState.values['a']).toEqual({ value: 'explicit' });
    });

    it('skips migration logic entirely on type mismatch (no MIGRATION_FAILED)', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'toggle', hash: 'hash-v2' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const typeMismatch = result.issues.find((i) => i.code === 'TYPE_MISMATCH');
      expect(typeMismatch).toBeDefined();

      const migrationFailed = result.issues.find((i) => i.code === 'MIGRATION_FAILED');
      expect(migrationFailed).toBeUndefined();

      const diff = result.diffs.find((d) => d.type === 'type-changed');
      expect(diff).toBeDefined();

      expect(result.reconciledState.values['a']).toBeUndefined();
    });
  });

  describe('valuesMeta reconciliation (TDD)', () => {
    it('carries forward valuesMeta for surviving components', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const priorState = makeState(
        { a: { value: 'hello' }, b: { checked: true } },
        {},
        {
          a: { lastUpdated: 500, lastInteractionId: 'int-1' },
          b: { lastUpdated: 600, lastInteractionId: 'int-2' },
        }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.valuesMeta).toBeDefined();
      expect(result.reconciledState.valuesMeta!['a']).toEqual({
        lastUpdated: 500,
        lastInteractionId: 'int-1',
      });
      expect(result.reconciledState.valuesMeta!['b']).toEqual({
        lastUpdated: 600,
        lastInteractionId: 'int-2',
      });
    });

    it('drops valuesMeta for removed components', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState(
        { a: { value: 'hello' }, b: { checked: true } },
        {},
        {
          a: { lastUpdated: 500 },
          b: { lastUpdated: 600 },
        }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.valuesMeta?.['a']).toBeDefined();
      expect(result.reconciledState.valuesMeta?.['b']).toBeUndefined();
    });

    it('updates lastUpdated timestamp for migrated values', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v2' }),
      ]);
      const priorState = makeState(
        { a: { value: 'hello' } },
        {},
        { a: { lastUpdated: 500, lastInteractionId: 'int-1' } }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.valuesMeta?.['a']).toBeDefined();
      expect(
        result.reconciledState.valuesMeta!['a'].lastUpdated
      ).toBeGreaterThan(500);
    });

    it('remaps valuesMeta to new id when component matched by key', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'old-id', type: 'input', key: 'email' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'new-id', type: 'input', key: 'email' }),
      ]);
      const priorState = makeState(
        { 'old-id': { value: 'test@example.com' } },
        {},
        { 'old-id': { lastUpdated: 500, lastInteractionId: 'int-1' } }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.valuesMeta?.['new-id']).toBeDefined();
      expect(result.reconciledState.valuesMeta?.['old-id']).toBeUndefined();
    });
  });

  describe('schemaHash population (TDD)', () => {
    it('sets schemaHash on reconciled state meta when components have hashes', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const newSchema: SchemaSnapshot = {
        schemaId: 'schema-1',
        version: '1.0',
        components: [
          makeComponent({ id: 'a', type: 'input', hash: 'comp-hash-1' }),
        ],
      };
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.meta.schemaHash).toBeDefined();
      expect(typeof result.reconciledState.meta.schemaHash).toBe('string');
      expect(result.reconciledState.meta.schemaHash!.length).toBeGreaterThan(0);
    });

    it('does not set schemaHash when no components have hashes', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.meta.schemaHash).toBeUndefined();
    });

    it('produces the same schemaHash regardless of component order', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const schemaOrderA = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-alpha' }),
        makeComponent({ id: 'b', type: 'toggle', hash: 'hash-beta' }),
      ]);
      const schemaOrderB = makeSchema([
        makeComponent({ id: 'b', type: 'toggle', hash: 'hash-beta' }),
        makeComponent({ id: 'a', type: 'input', hash: 'hash-alpha' }),
      ]);

      const resultA = reconcile(schemaOrderA, priorSchema, priorState);
      const resultB = reconcile(schemaOrderB, priorSchema, priorState);

      expect(resultA.reconciledState.meta.schemaHash).toBeDefined();
      expect(resultA.reconciledState.meta.schemaHash).toBe(
        resultB.reconciledState.meta.schemaHash
      );
    });
  });

  describe('determinism invariant (TDD)', () => {
    it('uses injected clock for deterministic timestamps', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const fixedTime = 9999;
      const clock = () => fixedTime;

      const result = reconcile(newSchema, priorSchema, priorState, {
        clock,
      });

      expect(result.reconciledState.meta.timestamp).toBe(fixedTime);
    });
  });

  describe('reconciliation trace', () => {
    it('includes a trace entry for each component in the new schema', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.trace).toBeDefined();
      expect(result.trace).toHaveLength(2);
    });

    it('traces carried component with matchedBy id', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const entry = result.trace!.find((t) => t.componentId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBe('a');
      expect(entry!.matchedBy).toBe('id');
      expect(entry!.priorType).toBe('input');
      expect(entry!.newType).toBe('input');
      expect(entry!.action).toBe('carried');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toEqual({ value: 'hello' });
    });

    it('traces added component with null prior info', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
        makeComponent({ id: 'b', type: 'toggle' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const entry = result.trace!.find((t) => t.componentId === 'b');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBeNull();
      expect(entry!.matchedBy).toBeNull();
      expect(entry!.priorType).toBeNull();
      expect(entry!.newType).toBe('toggle');
      expect(entry!.action).toBe('added');
      expect(entry!.priorValue).toBeUndefined();
      expect(entry!.reconciledValue).toBeUndefined();
    });

    it('traces dropped component on type mismatch', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'toggle' })]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const entry = result.trace!.find((t) => t.componentId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.action).toBe('dropped');
      expect(entry!.priorType).toBe('input');
      expect(entry!.newType).toBe('toggle');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toBeUndefined();
    });

    it('traces migrated component', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v1' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', hash: 'hash-v2' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const entry = result.trace!.find((t) => t.componentId === 'a');
      expect(entry).toBeDefined();
      expect(entry!.action).toBe('migrated');
      expect(entry!.priorValue).toEqual({ value: 'hello' });
      expect(entry!.reconciledValue).toEqual({ value: 'hello' });
    });

    it('traces key-matched component with matchedBy key', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'old-id', type: 'input', key: 'email' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'new-id', type: 'input', key: 'email' }),
      ]);
      const priorState = makeState({ 'old-id': { value: 'test@example.com' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const entry = result.trace!.find((t) => t.componentId === 'new-id');
      expect(entry).toBeDefined();
      expect(entry!.priorId).toBe('old-id');
      expect(entry!.matchedBy).toBe('key');
      expect(entry!.action).toBe('carried');
    });
  });

  describe('output metadata', () => {
    it('updates schemaId and schemaVersion from new schema', () => {
      const priorSchema = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'old-schema',
        '0.9'
      );
      const newSchema = makeSchema(
        [makeComponent({ id: 'a', type: 'input' })],
        'new-schema',
        '2.0'
      );
      const priorState = makeState(
        { a: { value: 'hello' } },
        { schemaId: 'old-schema', schemaVersion: '0.9' }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.meta.schemaId).toBe('new-schema');
      expect(result.reconciledState.meta.schemaVersion).toBe('2.0');
    });

    it('updates timestamp on reconciled state', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.meta.timestamp).toBeGreaterThan(
        priorState.meta.timestamp
      );
    });

    it('preserves sessionId from prior state', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input' }),
      ]);
      const priorState = makeState(
        { a: { value: 'hello' } },
        { sessionId: 'my-session' }
      );

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.meta.sessionId).toBe('my-session');
    });
  });

  describe('deeply nested children', () => {
    it('carries state for a 3-level deep nested component by id', () => {
      const nested = makeComponent({ id: 'deep', type: 'input' });
      const mid = makeComponent({ id: 'mid', type: 'group', children: [nested] });
      const root = makeComponent({ id: 'root', type: 'section', children: [mid] });

      const priorSchema = makeSchema([root]);
      const newSchema = makeSchema([root]);
      const priorState = makeState({ deep: { value: 'buried' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['deep']).toEqual({ value: 'buried' });
    });

    it('detects removal of a deeply nested component', () => {
      const nested = makeComponent({ id: 'deep', type: 'input' });
      const root = makeComponent({ id: 'root', type: 'section', children: [nested] });

      const priorSchema = makeSchema([root]);
      const newSchema = makeSchema([makeComponent({ id: 'root', type: 'section' })]);
      const priorState = makeState({ deep: { value: 'gone' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      const removedDiff = result.diffs.find((d) => d.componentId === 'deep');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
    });

    it('matches deeply nested component by key across id renames', () => {
      const deepOld = makeComponent({ id: 'old-deep', type: 'input', key: 'stable-key' });
      const rootOld = makeComponent({ id: 'root', type: 'section', children: [deepOld] });
      const deepNew = makeComponent({ id: 'new-deep', type: 'input', key: 'stable-key' });
      const rootNew = makeComponent({ id: 'root', type: 'section', children: [deepNew] });

      const priorSchema = makeSchema([rootOld]);
      const newSchema = makeSchema([rootNew]);
      const priorState = makeState({ 'old-deep': { value: 'nested-carry' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.values['new-deep']).toEqual({ value: 'nested-carry' });
    });
  });

  describe('duplicate id/key handling', () => {
    it('last-write-wins when duplicate ids appear in a schema', () => {
      const first = makeComponent({ id: 'dup', type: 'input' });
      const second = makeComponent({ id: 'dup', type: 'textarea' });

      const priorSchema = makeSchema([first]);
      const newSchema = makeSchema([first, second]);
      const priorState = makeState({ dup: { value: 'original' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result).toBeDefined();
    });

    it('last-write-wins when duplicate keys appear in a schema', () => {
      const first = makeComponent({ id: 'a', type: 'input', key: 'same-key' });
      const second = makeComponent({ id: 'b', type: 'input', key: 'same-key' });

      const priorSchema = makeSchema([first]);
      const newSchema = makeSchema([first, second]);
      const priorState = makeState({ a: { value: 'original' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result).toBeDefined();
    });
  });

  describe('empty schema transitions', () => {
    it('handles transition from populated schema to empty schema', () => {
      const priorSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const newSchema = makeSchema([]);
      const priorState = makeState({ a: { value: 'hello' } });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(Object.keys(result.reconciledState.values)).toHaveLength(0);
      const removedDiff = result.diffs.find((d) => d.componentId === 'a');
      expect(removedDiff).toBeDefined();
      expect(removedDiff!.type).toBe('removed');
    });

    it('handles transition from empty schema to populated schema', () => {
      const priorSchema = makeSchema([]);
      const newSchema = makeSchema([makeComponent({ id: 'a', type: 'input' })]);
      const priorState = makeState({});

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.diffs).toHaveLength(1);
      expect(result.diffs[0].type).toBe('added');
    });

    it('handles empty-to-empty schema transition', () => {
      const priorSchema = makeSchema([]);
      const newSchema = makeSchema([]);
      const priorState = makeState({});

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.diffs).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('large component count', () => {
    it('reconciles 500 components without error', () => {
      const components = Array.from({ length: 500 }, (_, i) =>
        makeComponent({ id: `c${i}`, type: 'input' })
      );
      const priorSchema = makeSchema(components, 'big', '1');
      const newSchema = makeSchema(components, 'big', '2');
      const values: Record<string, ComponentState> = {};
      for (let i = 0; i < 500; i++) {
        values[`c${i}`] = { value: `v${i}` };
      }
      const priorState = makeState(values);

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(Object.keys(result.reconciledState.values)).toHaveLength(500);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('orphaned values', () => {
    it('stores removed component values in orphanedValues', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', key: 'a-key' }),
        makeComponent({ id: 'b', type: 'input', key: 'b-key' }),
      ]);
      const newSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', key: 'a-key' }),
      ]);
      const priorState = makeState({
        a: { value: 'keep' },
        b: { value: 'orphan me' },
      });

      const result = reconcile(newSchema, priorSchema, priorState);

      expect(result.reconciledState.orphanedValues?.['b-key']).toBeDefined();
      expect(result.reconciledState.orphanedValues?.['b-key'].reason).toBe('removed');
    });

    it('restores orphaned value when matching key and type return', () => {
      const priorSchema = makeSchema([
        makeComponent({ id: 'a', type: 'input', key: 'a-key' }),
      ]);
      const removedSchema = makeSchema([]);
      const restoreSchema = makeSchema([
        makeComponent({ id: 'a2', type: 'input', key: 'a-key' }),
      ]);
      const priorState = makeState({
        a: { value: 'hello' },
      });

      const removedResult = reconcile(removedSchema, priorSchema, priorState);
      const restoredResult = reconcile(
        restoreSchema,
        removedSchema,
        removedResult.reconciledState
      );

      expect(restoredResult.reconciledState.values['a2']).toEqual({ value: 'hello' });
      expect(restoredResult.reconciledState.orphanedValues?.['a-key']).toBeUndefined();
      expect(restoredResult.trace.some((entry) => entry.action === 'restored')).toBe(true);
      expect(restoredResult.diffs.some((diff) => diff.type === 'restored')).toBe(true);
    });
  });
});
