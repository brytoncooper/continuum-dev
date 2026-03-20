export const CONTINUUM_TRANSFORM_STRATEGIES = {
  IDENTITY: 'identity',
  CONCAT_SPACE: 'concat-space',
  SPLIT_SPACE: 'split-space',
} as const;

export type ContinuumTransformStrategyId =
  | 'identity'
  | 'concat-space'
  | 'split-space';

export interface ContinuumTransformPlan {
  operations: ContinuumTransformOperation[];
}

export type ContinuumCarryTransformOperation = {
  kind: 'carry';
  sourceNodeId: string;
  targetNodeId: string;
};

export type ContinuumMergeTransformOperation = {
  kind: 'merge';
  sourceNodeIds: string[];
  targetNodeId: string;
  strategyId: Extract<
    ContinuumTransformStrategyId,
    'identity' | 'concat-space'
  >;
};

export type ContinuumSplitTransformOperation = {
  kind: 'split';
  sourceNodeId: string;
  targetNodeIds: string[];
  strategyId: Extract<ContinuumTransformStrategyId, 'split-space'>;
};

export type ContinuumDropTransformOperation = {
  kind: 'drop';
  sourceNodeIds: string[];
  reason?: string;
};

export type ContinuumDetachTransformOperation = {
  kind: 'detach';
  sourceNodeIds: string[];
  reason?: string;
};

export type ContinuumTransformOperation =
  | ContinuumCarryTransformOperation
  | ContinuumMergeTransformOperation
  | ContinuumSplitTransformOperation
  | ContinuumDropTransformOperation
  | ContinuumDetachTransformOperation;
