import type { ReconciliationResolution } from '../../types.js';

export type ResolutionMatchStrategy = Exclude<
  ReconciliationResolution['matchedBy'],
  null
>;

export interface CarriedResolutionInput {
  nodeId: string;
  priorId: string;
  matchedBy: ResolutionMatchStrategy;
  nodeType: string;
  priorValue: unknown;
  reconciledValue: unknown;
}

export interface DetachedResolutionInput {
  nodeId: string;
  priorId: string;
  matchedBy: ReconciliationResolution['matchedBy'];
  priorType: string;
  newType: string;
  priorValue: unknown;
}

export interface MigratedResolutionInput {
  nodeId: string;
  priorId: string;
  matchedBy: ReconciliationResolution['matchedBy'];
  priorType: string;
  newType: string;
  priorValue: unknown;
  reconciledValue: unknown;
}
