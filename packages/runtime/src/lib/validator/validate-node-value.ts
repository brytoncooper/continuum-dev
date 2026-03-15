import type { FieldNode, NodeValue, ViewNode } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';
import {
  evaluateNumericConstraints,
  evaluateRequiredConstraint,
  evaluateStringConstraints,
} from './rule-evaluators.js';
import { readStateValue } from './value-readers.js';

function isFieldNode(node: ViewNode): node is FieldNode {
  return node.type === 'field';
}

export function validateNodeValue(
  node: ViewNode,
  state: NodeValue | undefined
): ReconciliationIssue[] {
  if (!isFieldNode(node) || !node.constraints) {
    return [];
  }

  const value = readStateValue({ state });
  const requiredIssue = evaluateRequiredConstraint({
    nodeId: node.id,
    value,
    constraints: node.constraints,
  });

  if (requiredIssue) {
    return [requiredIssue];
  }

  const issues: ReconciliationIssue[] = [];

  if (typeof value === 'number') {
    issues.push(
      ...evaluateNumericConstraints({
        nodeId: node.id,
        value,
        constraints: node.constraints,
      })
    );
  }

  if (typeof value === 'string') {
    issues.push(
      ...evaluateStringConstraints({
        nodeId: node.id,
        value,
        constraints: node.constraints,
      })
    );
  }

  return issues;
}
