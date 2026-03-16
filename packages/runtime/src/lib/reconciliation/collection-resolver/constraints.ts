import type { NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/protocol';
import {
  collectTemplateDefaults,
  normalizeMaxItems,
  normalizeMinItems,
} from './defaults.js';
import type { ApplyItemConstraintsInput } from './types.js';

export function applyItemConstraints(
  input: ApplyItemConstraintsInput
): Array<{ values: Record<string, NodeValue> }> {
  const { items, minItems, maxItems, issues, nodeId, template } = input;
  let constrained = [...items];
  const min = normalizeMinItems(minItems);
  const max = normalizeMaxItems(maxItems);

  if (max !== undefined && constrained.length > max) {
    constrained = constrained.slice(0, max);
    issues.push({
      severity: ISSUE_SEVERITY.WARNING,
      nodeId,
      message: `Collection ${nodeId} exceeded maxItems`,
      code: ISSUE_CODES.COLLECTION_CONSTRAINT_VIOLATED,
    });
  }

  while (constrained.length < min) {
    constrained.push({ values: collectTemplateDefaults(template) });
    issues.push({
      severity: ISSUE_SEVERITY.INFO,
      nodeId,
      message: `Collection ${nodeId} filled to minItems`,
      code: ISSUE_CODES.COLLECTION_CONSTRAINT_VIOLATED,
    });
  }

  return constrained;
}
