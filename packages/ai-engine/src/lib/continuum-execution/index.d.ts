import type { ViewDefinition } from '@continuum-dev/core';

export type ContinuumExecutionMode = 'state' | 'patch' | 'transform' | 'view';

export interface ContinuumExecutionTarget {
  nodeId: string;
  key?: string;
  semanticKey?: string;
  label?: string;
  nodeType?: string;
}

export interface ContinuumExecutionPlan {
  mode: ContinuumExecutionMode;
  fallback: 'patch' | 'transform' | 'view';
  reason?: string;
  targetNodeIds: string[];
  targetSemanticKeys: string[];
  authoringMode?: 'create-view' | 'evolve-view';
  endpointId?: string;
  payloadSemanticKeys?: string[];
}

export interface ContinuumResolvedExecutionPlan extends ContinuumExecutionPlan {
  validation:
    | 'accepted'
    | 'invalid-plan'
    | 'state-unavailable'
    | 'patch-unavailable'
    | 'transform-unavailable'
    | 'unknown-targets'
    | 'missing-targets'
    | 'partial-targets';
  integrationValidation?:
    | 'accepted'
    | 'missing-endpoint'
    | 'invalid-endpoint'
    | 'missing-payload-keys'
    | 'partial-payload-keys'
    | 'not-applicable';
}

export function getAvailableContinuumExecutionModes(args?: {
  hasCurrentView?: boolean;
  hasStateTargets?: boolean;
}): ContinuumExecutionMode[];

export function buildContinuumExecutionPlannerSystemPrompt(args?: {
  hasRestoreContinuity?: boolean;
  integrationCatalog?: unknown;
  registeredActions?: Record<string, unknown>;
}): string;

export function buildContinuumExecutionPlannerUserPrompt(args?: {
  availableModes?: ContinuumExecutionMode[];
  patchTargets?: ContinuumExecutionTarget[];
  stateTargets?: ContinuumExecutionTarget[];
  compactTree?: unknown[];
  currentData?: Record<string, unknown>;
  instruction?: string;
  conversationSummary?: string;
  detachedFields?: unknown[];
  integrationCatalog?: unknown;
  registeredActions?: Record<string, unknown>;
}): string;

export function buildIntegrationBindingParagraph(args?: {
  integrationCatalog?: unknown;
  endpointId?: string;
  payloadSemanticKeys?: string[];
}): string;

export function buildRegisteredActionsParagraph(args?: {
  registeredActions?: Record<string, unknown>;
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
  integrationCatalog?: unknown;
}): ContinuumResolvedExecutionPlan;

export function normalizeContinuumSemanticIdentity(args?: {
  currentView?: ViewDefinition | null;
  nextView?: ViewDefinition | null;
}): {
  view: ViewDefinition | null | undefined;
  errors: string[];
};
