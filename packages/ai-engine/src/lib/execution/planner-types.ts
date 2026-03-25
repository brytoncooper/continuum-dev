export type ContinuumExecutionMode =
  | 'state'
  | 'patch'
  | 'transform'
  | 'view';

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
