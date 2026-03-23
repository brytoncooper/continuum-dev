import type { ViewDefinition } from '@continuum-dev/core';
import { normalizeViewDefinition } from '../../../view-guardrails/index.js';
import { normalizeGeneratedView } from '../../../view-generation/normalize/normalize.js';

export function normalizePreviewView(
  currentView: ViewDefinition | undefined,
  candidateView: ViewDefinition
): ViewDefinition | null {
  try {
    if (currentView) {
      return normalizeGeneratedView(currentView, candidateView);
    }

    return normalizeViewDefinition(candidateView);
  } catch {
    return null;
  }
}

export function shouldAttemptPreview(
  nextView: ViewDefinition,
  lastPreviewSignature: string | null
): boolean {
  const signature = JSON.stringify(nextView);
  return signature !== lastPreviewSignature;
}
