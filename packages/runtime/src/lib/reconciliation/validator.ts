import type { ComponentDefinition, ComponentState } from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type { ReconciliationIssue } from '../types.js';

function readStateValue(state: ComponentState | undefined): unknown {
  if (!state || typeof state !== 'object') {
    return undefined;
  }
  const raw = state as Record<string, unknown>;
  if ('value' in raw) return raw.value;
  if ('checked' in raw) return raw.checked;
  if ('selectedIds' in raw) return raw.selectedIds;
  return undefined;
}

function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateComponentState(
  definition: ComponentDefinition,
  state: ComponentState | undefined
): ReconciliationIssue[] {
  const constraints = definition.constraints;
  if (!constraints) return [];

  const value = readStateValue(state);
  const issues: ReconciliationIssue[] = [];

  if (constraints.required && isEmptyValue(value)) {
    issues.push({
      severity: ISSUE_SEVERITY.WARNING,
      componentId: definition.id,
      message: `Component ${definition.id} failed required validation`,
      code: ISSUE_CODES.VALIDATION_FAILED,
    });
    return issues;
  }

  if (typeof value === 'number') {
    if (typeof constraints.min === 'number' && value < constraints.min) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        componentId: definition.id,
        message: `Component ${definition.id} is below minimum ${constraints.min}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (typeof constraints.max === 'number' && value > constraints.max) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        componentId: definition.id,
        message: `Component ${definition.id} is above maximum ${constraints.max}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
  }

  if (typeof value === 'string') {
    if (typeof constraints.minLength === 'number' && value.length < constraints.minLength) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        componentId: definition.id,
        message: `Component ${definition.id} is shorter than minLength ${constraints.minLength}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (typeof constraints.maxLength === 'number' && value.length > constraints.maxLength) {
      issues.push({
        severity: ISSUE_SEVERITY.WARNING,
        componentId: definition.id,
        message: `Component ${definition.id} is longer than maxLength ${constraints.maxLength}`,
        code: ISSUE_CODES.VALIDATION_FAILED,
      });
    }
    if (constraints.pattern) {
      try {
        const pattern = new RegExp(constraints.pattern);
        if (!pattern.test(value)) {
          issues.push({
            severity: ISSUE_SEVERITY.WARNING,
            componentId: definition.id,
            message: `Component ${definition.id} does not match pattern ${constraints.pattern}`,
            code: ISSUE_CODES.VALIDATION_FAILED,
          });
        }
      } catch {
        issues.push({
          severity: ISSUE_SEVERITY.WARNING,
          componentId: definition.id,
          message: `Component ${definition.id} has invalid validation pattern`,
          code: ISSUE_CODES.VALIDATION_FAILED,
        });
      }
    }
  }

  return issues;
}
