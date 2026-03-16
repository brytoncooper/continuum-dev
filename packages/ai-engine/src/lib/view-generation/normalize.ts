import type { ViewDefinition } from '@continuum-dev/core';
import { normalizeContinuumSemanticIdentity } from '../continuum-execution/index.mjs';
import {
  buildRuntimeErrors,
  collectStructuralErrors,
  collectUnsupportedNodeTypes,
  isViewDefinition,
  normalizeViewDefinition,
  SUPPORTED_NODE_TYPE_VALUES,
} from '../view-guardrails/index.js';

export function collectCandidateViewErrors(
  currentView: ViewDefinition,
  candidate: unknown
): string[] {
  const errors: string[] = [];

  if (!isViewDefinition(candidate)) {
    errors.push('Model output did not compile into a valid ViewDefinition.');
    return errors;
  }

  const identityResult = normalizeContinuumSemanticIdentity({
    currentView,
    nextView: candidate,
  });
  errors.push(...identityResult.errors);

  const unsupported = collectUnsupportedNodeTypes(candidate.nodes);
  if (unsupported.length > 0) {
    errors.push(`Unsupported node types: ${unsupported.join(', ')}.`);
  }

  errors.push(...collectStructuralErrors(candidate.nodes));
  return errors;
}

export function normalizeGeneratedView(
  currentView: ViewDefinition,
  nextView: ViewDefinition
): ViewDefinition {
  const normalizedIdentity = normalizeContinuumSemanticIdentity({
    currentView,
    nextView,
  });
  if (normalizedIdentity.errors.length > 0 || !normalizedIdentity.view) {
    throw new Error(
      normalizedIdentity.errors[0] ??
        'Generated view failed semantic identity validation.'
    );
  }

  const normalizedView = normalizeViewDefinition(normalizedIdentity.view);
  const unsupported = collectUnsupportedNodeTypes(normalizedView.nodes);
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported node types returned: ${unsupported.join(', ')}. Supported types: ${SUPPORTED_NODE_TYPE_VALUES.join(', ')}.`
    );
  }

  const structuralErrors = collectStructuralErrors(normalizedView.nodes);
  if (structuralErrors.length > 0) {
    throw new Error(`Malformed view from model: ${structuralErrors[0]}`);
  }

  return normalizedView;
}

export { buildRuntimeErrors };
