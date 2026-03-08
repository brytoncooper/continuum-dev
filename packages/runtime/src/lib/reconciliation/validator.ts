import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';

function readStateValue(state: NodeValue | undefined): unknown {
  if (!state) {
    return undefined;
  }
  return state.value;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validates a node value against contract constraints and emits runtime issues.
 *
 * This helper is exported so host applications can run the same validation
 * semantics used during reconciliation for custom workflows.
 *
 * @param node View node containing optional constraint metadata.
 * @param state Current node state value to validate.
 * @returns Zero or more validation issues.
 */
export function validateNodeValue(
  node: ViewNode,
  state: NodeValue | undefined
): ReconciliationIssue[] {
  const constraints = 'constraints' in node ? node.constraints : undefined;
  if (!constraints) return [];

  const value = readStateValue(state);
  const issues: ReconciliationIssue[] = [];

  if (constraints.required && isEmptyValue(value)) {
    issues.push({
      severity: ISSUE_SEVERITY.WARNING,
      nodeId: node.id,
      message: `Node ${node.id} failed required validation`,
      code: ISSUE_CODES.VALIDATION_FAILED,
    });
    return issues;
  }

  if (typeof value === 'number') {
    if (typeof constraints.min === 'number' && value < constraints.min) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: node.id,
        message: `Node ${node.id} is below minimum ${constraints.min}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (typeof constraints.max === 'number' && value > constraints.max) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: node.id,
        message: `Node ${node.id} is above maximum ${constraints.max}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
  }

  if (typeof value === 'string') {
    if (
      typeof constraints.minLength === 'number' &&
      value.length < constraints.minLength
    ) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: node.id,
        message: `Node ${node.id} is shorter than minLength ${constraints.minLength}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (
      typeof constraints.maxLength === 'number' &&
      value.length > constraints.maxLength
    ) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        nodeId: node.id,
        message: `Node ${node.id} is longer than maxLength ${constraints.maxLength}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (constraints.pattern) {
      try {
        const pattern = new RegExp(constraints.pattern);
        if (!pattern.test(value)) {
          issues.push({
            severity: ISSUE_SEVERITY.WARNING,
            nodeId: node.id,
            message: `Node ${node.id} does not match pattern ${constraints.pattern}`,
            code: ISSUE_CODES.VALIDATION_FAILED,
          });
        }
      } catch {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          nodeId: node.id,
          message: `Node ${node.id} has invalid validation pattern`,
          code: ISSUE_CODES.VALIDATION_FAILED,
        });
      }
    }
  }

  return issues;
}
