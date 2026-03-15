import type { ReconciliationIssue } from '../types.js';
import { validationFailedIssue } from './issue-factories.js';
import type {
  NumericConstraintEvaluationInput,
  RequiredConstraintEvaluationInput,
  StringConstraintEvaluationInput,
} from './types.js';
import { isEmptyValue } from './value-readers.js';

export function evaluateRequiredConstraint({
  nodeId,
  value,
  constraints,
}: RequiredConstraintEvaluationInput): ReconciliationIssue | null {
  if (!constraints.required || !isEmptyValue({ value })) {
    return null;
  }

  return validationFailedIssue({
    nodeId,
    message: `Node ${nodeId} failed required validation`,
  });
}

export function evaluateNumericConstraints({
  nodeId,
  value,
  constraints,
}: NumericConstraintEvaluationInput): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  if (typeof constraints.min === 'number' && value < constraints.min) {
    issues.push(
      validationFailedIssue({
        nodeId,
        message: `Node ${nodeId} is below minimum ${constraints.min}`,
      })
    );
  }

  if (typeof constraints.max === 'number' && value > constraints.max) {
    issues.push(
      validationFailedIssue({
        nodeId,
        message: `Node ${nodeId} is above maximum ${constraints.max}`,
      })
    );
  }

  return issues;
}

export function evaluateStringConstraints({
  nodeId,
  value,
  constraints,
}: StringConstraintEvaluationInput): ReconciliationIssue[] {
  const issues: ReconciliationIssue[] = [];

  if (
    typeof constraints.minLength === 'number' &&
    value.length < constraints.minLength
  ) {
    issues.push(
      validationFailedIssue({
        nodeId,
        message: `Node ${nodeId} is shorter than minLength ${constraints.minLength}`,
      })
    );
  }

  if (
    typeof constraints.maxLength === 'number' &&
    value.length > constraints.maxLength
  ) {
    issues.push(
      validationFailedIssue({
        nodeId,
        message: `Node ${nodeId} is longer than maxLength ${constraints.maxLength}`,
      })
    );
  }

  if (constraints.pattern) {
    try {
      const pattern = new RegExp(constraints.pattern);
      if (!pattern.test(value)) {
        issues.push(
          validationFailedIssue({
            nodeId,
            message: `Node ${nodeId} does not match pattern ${constraints.pattern}`,
          })
        );
      }
    } catch {
      issues.push(
        validationFailedIssue({
          nodeId,
          message: `Node ${nodeId} has invalid validation pattern`,
        })
      );
    }
  }

  return issues;
}
