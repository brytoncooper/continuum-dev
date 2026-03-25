import type { IssueCode, IssueSeverity } from './constants.js';

/**
 * One machine-readable finding from comparing two view revisions and optional
 * data snapshots during AI-authored structural edits.
 */
export interface ViewEvolutionDiagnostic {
  code: IssueCode;
  severity: IssueSeverity;
  message: string;
  metric?: number;
  nodeId?: string;
  semanticKey?: string;
}

/**
 * Numeric summary of structural churn between a prior and next view.
 */
export interface ViewEvolutionMetrics {
  nodesReplaced: number;
  nodesPatchedInPlace: number;
  replacementRatio: number;
  semanticKeyChurnCount: number;
  continuityLossCount: number;
  detachedFieldDelta: number;
  maxLayoutDepthPrior: number;
  maxLayoutDepthNext: number;
  layoutDepthDelta: number;
  orphanedActionCount: number;
}

/**
 * Diagnostics bundle returned by runtime evaluation of a view transition.
 */
export interface ViewEvolutionDiagnostics {
  issues: ViewEvolutionDiagnostic[];
  metrics: ViewEvolutionMetrics;
}

/**
 * Caller- or planner-supplied scope for a localized edit. OSS does not infer
 * this automatically; premium or host wiring may attach it to execution.
 */
export interface ScopedEditBrief {
  goal: string;
  affectedRegion?: string;
  allowedOperations?: readonly string[];
  expectedContinuityImpact?: 'low' | 'medium' | 'high';
  validationConstraints?: Record<string, unknown>;
}

/**
 * Serializable record for exemplar corpora and offline review of edit quality.
 */
export interface ContinuumEditExemplarTrace {
  traceId: string;
  phase: 'patch' | 'transform' | 'view' | 'state';
  priorViewId: string;
  instruction: string;
  scopedBrief?: ScopedEditBrief;
  accepted: boolean;
  diagnostics?: ViewEvolutionDiagnostics;
  rejectionReason?: string;
}
