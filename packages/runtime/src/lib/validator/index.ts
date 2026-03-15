import { validateNodeValue as validateNodeValueImpl } from './validate-node-value.js';
import type {
  IsEmptyValueInput as IsEmptyValueInputModel,
  NodeValidationInput as NodeValidationInputModel,
  NumericConstraintEvaluationInput as NumericConstraintEvaluationInputModel,
  ReadStateValueInput as ReadStateValueInputModel,
  RequiredConstraintEvaluationInput as RequiredConstraintEvaluationInputModel,
  StringConstraintEvaluationInput as StringConstraintEvaluationInputModel,
  ValidationIssueInput as ValidationIssueInputModel,
} from './types.js';

/**
 * Stable public boundary for contract-driven node validation.
 *
 * Why this boundary exists:
 * - keeps callers off validator implementation files
 * - centralizes validation semantics shared by reconciliation and session flows
 * - exposes typed object contracts for internal evaluator/readers
 *
 * Import policy:
 * - import from `../validator/index.js`
 * - avoid deep imports into files under `validator/`
 */

/**
 * Validates a node value against field constraints and emits validation issues.
 *
 * Input contract:
 * - `node`: any `ViewNode`; only `field` nodes with `constraints` are evaluated
 * - `state`: optional `NodeValue`; validation reads `state?.value`
 *
 * Output contract:
 * - returns `ReconciliationIssue[]`
 * - all emitted issues use `ISSUE_CODES.VALIDATION_FAILED`
 * - all emitted issues use `ISSUE_SEVERITY.WARNING`
 *
 * Behavior guarantees:
 * - non-field nodes or field nodes without constraints return `[]`
 * - required check runs first and short-circuits on failure
 * - numeric constraints (`min`, `max`) apply only when value is a number
 * - string constraints (`minLength`, `maxLength`, `pattern`) apply only when value is a string
 * - invalid regex patterns are reported as issues instead of throwing
 *
 * Deterministic ordering:
 * - required failure returns a single issue and exits
 * - numeric issues emit in `min` then `max` order
 * - string issues emit in `minLength`, `maxLength`, then `pattern` order
 *
 * Example:
 * ```ts
 * const issues = validateNodeValue(
 *   { id: 'email', type: 'field', dataType: 'string', constraints: { pattern: '^.+@.+$' } },
 *   { value: 'not-an-email' }
 * );
 * ```
 */
export const validateNodeValue = validateNodeValueImpl;

/**
 * Object input contract for reading `state?.value` from validator state.
 *
 * Shape:
 * - `state: NodeValue | undefined`
 */
export type ReadStateValueInput = ReadStateValueInputModel;

/**
 * Object input contract for required-rule emptiness checks.
 *
 * Shape:
 * - `value: unknown`
 */
export type IsEmptyValueInput = IsEmptyValueInputModel;

/**
 * Object input contract for validation issue creation.
 *
 * Shape:
 * - `nodeId: string`
 * - `message: string`
 */
export type ValidationIssueInput = ValidationIssueInputModel;

/**
 * Object input contract for required-rule evaluation.
 *
 * Shape:
 * - `nodeId: string`
 * - `value: unknown`
 * - `constraints: FieldConstraints`
 */
export type RequiredConstraintEvaluationInput =
  RequiredConstraintEvaluationInputModel;

/**
 * Object input contract for numeric constraint evaluation.
 *
 * Shape:
 * - `nodeId: string`
 * - `value: number`
 * - `constraints: FieldConstraints`
 */
export type NumericConstraintEvaluationInput =
  NumericConstraintEvaluationInputModel;

/**
 * Object input contract for string constraint evaluation.
 *
 * Shape:
 * - `nodeId: string`
 * - `value: string`
 * - `constraints: FieldConstraints`
 */
export type StringConstraintEvaluationInput =
  StringConstraintEvaluationInputModel;

/**
 * Object input contract for orchestration-level validation calls.
 *
 * Shape:
 * - `node: FieldNode`
 * - `state: NodeValue | undefined`
 */
export type NodeValidationInput = NodeValidationInputModel;
