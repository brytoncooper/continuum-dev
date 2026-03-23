import type { ViewDefinition } from '@continuum-dev/core';
import { normalizeViewDefinition } from '../../../view-guardrails/index.js';
import { normalizeGeneratedView } from '../../../view-generation/normalize/normalize.js';

export function finalizeGeneratedView(args: {
  currentView?: ViewDefinition;
  candidateView: ViewDefinition;
}): ViewDefinition {
  if (args.currentView) {
    return normalizeGeneratedView(args.currentView, args.candidateView);
  }

  return normalizeViewDefinition(args.candidateView);
}
