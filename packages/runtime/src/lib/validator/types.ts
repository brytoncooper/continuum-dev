import type {
  FieldConstraints,
  FieldNode,
  NodeValue,
} from '@continuum-dev/contract';

export interface ReadStateValueInput {
  state: NodeValue | undefined;
}

export interface IsEmptyValueInput {
  value: unknown;
}

export interface ValidationIssueInput {
  nodeId: string;
  message: string;
}

export interface NumericConstraintEvaluationInput {
  nodeId: string;
  value: number;
  constraints: FieldConstraints;
}

export interface StringConstraintEvaluationInput {
  nodeId: string;
  value: string;
  constraints: FieldConstraints;
}

export interface RequiredConstraintEvaluationInput {
  nodeId: string;
  value: unknown;
  constraints: FieldConstraints;
}

export interface NodeValidationInput {
  node: FieldNode;
  state: NodeValue | undefined;
}
