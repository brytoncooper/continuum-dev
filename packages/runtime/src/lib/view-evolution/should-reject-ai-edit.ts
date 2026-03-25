import { ISSUE_SEVERITY } from '@continuum-dev/protocol';
import type { ViewEvolutionDiagnostics } from '@continuum-dev/protocol';

export interface ShouldRejectAiEditDiagnosticsOptions {
  /**
   * When true, high stateful-node replacement ratio does not force rejection.
   * Use for surgical transform flows where merges and removes are expected.
   */
  ignoreReplacementRatio?: boolean;
}

/**
 * Returns true when diagnostics indicate the edit should be rejected or retried
 * with corrective feedback rather than committed as-is.
 */
export function shouldRejectAiEditDiagnostics(
  diagnostics: ViewEvolutionDiagnostics,
  options?: ShouldRejectAiEditDiagnosticsOptions
): boolean {
  if (
    diagnostics.issues.some((issue) => issue.severity === ISSUE_SEVERITY.ERROR)
  ) {
    return true;
  }

  const { metrics } = diagnostics;
  if (metrics.semanticKeyChurnCount > 3) {
    return true;
  }
  if (metrics.continuityLossCount > 2) {
    return true;
  }
  if (!options?.ignoreReplacementRatio && metrics.replacementRatio > 0.5) {
    return true;
  }
  if (metrics.detachedFieldDelta > 0) {
    return true;
  }

  return false;
}
