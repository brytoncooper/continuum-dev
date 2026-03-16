import type { ViewDefinition } from '@continuum-dev/core';

export type ContinuumExecutionMode = 'state' | 'patch' | 'view';

export interface ContinuumExecutionTarget {
  nodeId: string;
  key?: string;
  semanticKey?: string;
  label?: string;
  nodeType?: string;
}

export interface ContinuumExecutionPlan {
  mode: ContinuumExecutionMode;
  fallback: 'patch' | 'view';
  reason?: string;
  targetNodeIds: string[];
  targetSemanticKeys: string[];
}

export interface ContinuumResolvedExecutionPlan
  extends ContinuumExecutionPlan {
  validation:
    | 'accepted'
    | 'invalid-plan'
    | 'state-unavailable'
    | 'patch-unavailable'
    | 'unknown-target-node'
    | 'unknown-target-semantic-key'
    | 'missing-targets';
}

export function getAvailableContinuumExecutionModes(args?: {
  hasCurrentView?: boolean;
  hasStateTargets?: boolean;
}): ContinuumExecutionMode[];

export function buildContinuumExecutionPlannerSystemPrompt(): string;

export function buildContinuumExecutionPlannerUserPrompt(args?: {
  availableModes?: ContinuumExecutionMode[];
  patchTargets?: ContinuumExecutionTarget[];
  stateTargets?: ContinuumExecutionTarget[];
  compactTree?: unknown[];
  currentData?: Record<string, unknown>;
  instruction?: string;
}): string;

export function parseContinuumExecutionPlan(args?: {
  text?: string;
  availableModes?: ContinuumExecutionMode[];
}): ContinuumExecutionPlan | null;

export function resolveContinuumExecutionPlan(args?: {
  text?: string;
  availableModes?: ContinuumExecutionMode[];
  patchTargets?: ContinuumExecutionTarget[];
  stateTargets?: ContinuumExecutionTarget[];
}): ContinuumResolvedExecutionPlan;

export function normalizeContinuumSemanticIdentity(args?: {
  currentView?: ViewDefinition | null;
  nextView?: ViewDefinition | null;
}): {
  view: ViewDefinition | null | undefined;
  errors: string[];
};
