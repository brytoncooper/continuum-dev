import type { ViewNode } from '@continuum-dev/contract';
import type {
  MigrationStrategy,
  MigrationStrategyContext,
  ReconciliationOptions,
} from '../../types.js';

export type MigrationAttemptResult =
  | { kind: 'migrated'; value: unknown }
  | { kind: 'none' }
  | { kind: 'error'; error: unknown };

interface RuleEdge {
  fromHash: string;
  toHash: string;
  strategyId: string;
}

interface MigrationPathRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}

export interface MigrationAttemptInput {
  nodeId: string;
  priorNode: ViewNode;
  newNode: ViewNode;
  priorValue: unknown;
  options: ReconciliationOptions;
}

interface MigrationPathRequest {
  rules: MigrationPathRule[];
  fromHash: string;
  toHash: string;
  strategyRegistry: Record<string, MigrationStrategy>;
}

const MAX_CHAIN_DEPTH = 10;
const CONTEXT_PROPERTY_NAMES = ['nodeId', 'priorNode', 'newNode', 'priorValue'];
const migrationStrategyDispatchCache = new WeakMap<
  MigrationStrategy,
  'context' | 'positional'
>();

export function attemptMigrationImpl(
  input: MigrationAttemptInput
): MigrationAttemptResult;
export function attemptMigrationImpl(
  nodeId: string,
  priorNode: ViewNode,
  newNode: ViewNode,
  priorValue: unknown,
  options: ReconciliationOptions
): MigrationAttemptResult;
export function attemptMigrationImpl(
  inputOrNodeId: MigrationAttemptInput | string,
  priorNode?: ViewNode,
  newNode?: ViewNode,
  priorValue?: unknown,
  options?: ReconciliationOptions
): MigrationAttemptResult {
  const input = normalizeMigrationAttemptInput(
    inputOrNodeId,
    priorNode,
    newNode,
    priorValue,
    options
  );

  const explicitResult = attemptExplicitMigration(input);
  if (explicitResult) {
    return explicitResult;
  }

  if (
    !input.newNode.migrations ||
    !input.priorNode.hash ||
    !input.newNode.hash
  ) {
    return { kind: 'none' };
  }

  if (!input.options.strategyRegistry) {
    return { kind: 'none' };
  }

  const directResult = attemptDirectRuleMigration(input);
  if (directResult) {
    return directResult;
  }

  return attemptChainMigration(input);
}

function normalizeMigrationAttemptInput(
  inputOrNodeId: MigrationAttemptInput | string,
  priorNode?: ViewNode,
  newNode?: ViewNode,
  priorValue?: unknown,
  options?: ReconciliationOptions
): MigrationAttemptInput {
  if (typeof inputOrNodeId === 'string') {
    return {
      nodeId: inputOrNodeId,
      priorNode: priorNode!,
      newNode: newNode!,
      priorValue,
      options: options!,
    };
  }

  return inputOrNodeId;
}

function toMigrationContext(
  input: MigrationAttemptInput
): MigrationStrategyContext {
  return {
    nodeId: input.nodeId,
    priorNode: input.priorNode,
    newNode: input.newNode,
    priorValue: input.priorValue,
  };
}

function attemptExplicitMigration(
  input: MigrationAttemptInput
): MigrationAttemptResult | null {
  const strategy = input.options.migrationStrategies?.[input.nodeId];
  if (!strategy) {
    return null;
  }

  try {
    return {
      kind: 'migrated',
      value: invokeMigrationStrategy(strategy, toMigrationContext(input)),
    };
  } catch (error) {
    return { kind: 'error', error };
  }
}

function findDirectRule(
  input: MigrationAttemptInput,
  strategyRegistry: Record<string, MigrationStrategy>
): RuleEdge | null {
  const directRule = input.newNode.migrations?.find(
    (rule) =>
      rule.fromHash === input.priorNode.hash &&
      rule.toHash === input.newNode.hash &&
      !!rule.strategyId &&
      !!strategyRegistry[rule.strategyId]
  );

  if (!directRule?.strategyId) {
    return null;
  }

  return {
    fromHash: directRule.fromHash,
    toHash: directRule.toHash,
    strategyId: directRule.strategyId,
  };
}

function attemptDirectRuleMigration(
  input: MigrationAttemptInput
): MigrationAttemptResult | null {
  const strategyRegistry = input.options.strategyRegistry!;
  const directRule = findDirectRule(input, strategyRegistry);
  if (!directRule) {
    return null;
  }

  try {
    return {
      kind: 'migrated',
      value: invokeMigrationStrategy(
        strategyRegistry[directRule.strategyId],
        toMigrationContext(input)
      ),
    };
  } catch (error) {
    return { kind: 'error', error };
  }
}

function attemptChainMigration(
  input: MigrationAttemptInput
): MigrationAttemptResult {
  const strategyRegistry = input.options.strategyRegistry!;
  const path = findMigrationPath({
    rules: input.newNode.migrations!,
    fromHash: input.priorNode.hash!,
    toHash: input.newNode.hash!,
    strategyRegistry,
  });

  if (!path) {
    return { kind: 'none' };
  }

  try {
    return {
      kind: 'migrated',
      value: executeChainMigration(path, input, strategyRegistry),
    };
  } catch (error) {
    return { kind: 'error', error };
  }
}

function executeChainMigration(
  path: RuleEdge[],
  input: MigrationAttemptInput,
  strategyRegistry: Record<string, MigrationStrategy>
): unknown {
  let currentValue = input.priorValue;
  let currentHash = input.priorNode.hash!;

  for (const step of path) {
    const strategy = strategyRegistry[step.strategyId];
    currentValue = invokeMigrationStrategy(strategy, {
      nodeId: input.nodeId,
      priorNode: { ...input.priorNode, hash: currentHash },
      newNode: { ...input.newNode, hash: step.toHash },
      priorValue: currentValue,
    });
    currentHash = step.toHash;
  }

  return currentValue;
}

function invokeMigrationStrategy(
  strategy: MigrationStrategy,
  context: MigrationStrategyContext
): unknown {
  const dispatchMode = resolveMigrationStrategyDispatchMode(strategy);
  if (dispatchMode === 'context') {
    return strategy(context);
  }

  return (
    strategy as unknown as (
      nodeId: string,
      priorNode: ViewNode,
      newNode: ViewNode,
      priorValue: unknown
    ) => unknown
  )(context.nodeId, context.priorNode, context.newNode, context.priorValue);
}

function resolveMigrationStrategyDispatchMode(
  strategy: MigrationStrategy
): 'context' | 'positional' {
  const cached = migrationStrategyDispatchCache.get(strategy);
  if (cached) {
    return cached;
  }

  const source = getMigrationStrategySource(strategy);
  const firstParameter = extractFirstParameterText(source);
  if (!firstParameter) {
    migrationStrategyDispatchCache.set(strategy, 'context');
    return 'context';
  }

  const trimmed = firstParameter.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    migrationStrategyDispatchCache.set(strategy, 'context');
    return 'context';
  }

  if (isIdentifier(trimmed) && referencesContextProperties(source, trimmed)) {
    migrationStrategyDispatchCache.set(strategy, 'context');
    return 'context';
  }

  migrationStrategyDispatchCache.set(strategy, 'positional');
  return 'positional';
}

function getMigrationStrategySource(strategy: MigrationStrategy): string {
  const mockCandidate = strategy as unknown as {
    getMockImplementation?: () => unknown;
  };
  const implementation = mockCandidate.getMockImplementation?.();
  if (typeof implementation === 'function') {
    return Function.prototype.toString.call(implementation);
  }

  return Function.prototype.toString.call(strategy);
}

function extractFirstParameterText(source: string): string | null {
  const functionMatch = source.match(
    /^\s*(?:async\s*)?(?:function\b[^(]*)\(\s*([^)]*)\)/s
  );
  if (functionMatch) {
    const params = functionMatch[1]?.trim() ?? '';
    return params.split(',')[0]?.trim() ?? null;
  }

  const parenthesizedArrowMatch = source.match(
    /^\s*(?:async\s*)?\(\s*([^)]*)\)\s*=>/s
  );
  if (parenthesizedArrowMatch) {
    const params = parenthesizedArrowMatch[1]?.trim() ?? '';
    return params.split(',')[0]?.trim() ?? null;
  }

  const singleParamArrowMatch = source.match(
    /^\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/s
  );
  return singleParamArrowMatch?.[1] ?? null;
}

function isIdentifier(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value);
}

function referencesContextProperties(
  source: string,
  parameterName: string
): boolean {
  return CONTEXT_PROPERTY_NAMES.some((property) => {
    const dotPattern = new RegExp(
      `\\b${parameterName}\\s*\\.\\s*${property}\\b`,
      's'
    );
    const bracketPattern = new RegExp(
      `\\b${parameterName}\\s*\\[\\s*['"]${property}['"]\\s*\\]`,
      's'
    );
    return dotPattern.test(source) || bracketPattern.test(source);
  });
}

function findMigrationPath(request: MigrationPathRequest): RuleEdge[] | null {
  const edges: RuleEdge[] = request.rules
    .filter(
      (rule) =>
        !!rule.strategyId && !!request.strategyRegistry[rule.strategyId!]
    )
    .map((rule) => ({
      fromHash: rule.fromHash,
      toHash: rule.toHash,
      strategyId: rule.strategyId!,
    }));

  const byFrom = new Map<string, RuleEdge[]>();
  for (const edge of edges) {
    const existing = byFrom.get(edge.fromHash) ?? [];
    existing.push(edge);
    byFrom.set(edge.fromHash, existing);
  }

  const queue: Array<{ hash: string; path: RuleEdge[] }> = [
    { hash: request.fromHash, path: [] },
  ];
  const seen = new Set<string>([request.fromHash]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextEdges = byFrom.get(current.hash) ?? [];
    for (const edge of nextEdges) {
      const nextPath = [...current.path, edge];
      if (nextPath.length > MAX_CHAIN_DEPTH) {
        continue;
      }
      if (edge.toHash === request.toHash) {
        return nextPath;
      }
      if (!seen.has(edge.toHash)) {
        seen.add(edge.toHash);
        queue.push({ hash: edge.toHash, path: nextPath });
      }
    }
  }

  return null;
}
