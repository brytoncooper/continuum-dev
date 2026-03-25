import type { ViewDefinition } from '@continuum-dev/core';

export function parseJson(text: string): unknown | null;

export function uniqueNonEmptyStrings(values: unknown[]): string[];

export function toBoolean(value: unknown): boolean;

export function getChildNodes(node: unknown): unknown[];

export function collectStatefulEntries(
  nodes: unknown[],
  parentPath?: string,
  entries?: unknown[]
): unknown[];

export function collectNodeEntries(
  nodes: unknown[],
  parentPath?: string,
  entries?: unknown[]
): unknown[];

export function indexTargets(targets: unknown[]): {
  byNodeId: Map<string, unknown>;
  bySemanticKey: Map<string, unknown>;
};

export function summarizeCurrentData(
  currentData: unknown,
  limit?: number
): unknown[];

export function cloneView<T>(view: T): T;

export function findNodeByCanonicalId(
  nodes: unknown[],
  canonicalId: string,
  parentPath?: string
): unknown | null;

export function normalizeContinuumSemanticIdentity(args?: {
  currentView?: ViewDefinition | null;
  nextView?: ViewDefinition | null;
}): {
  view: ViewDefinition | null | undefined;
  errors: string[];
};
