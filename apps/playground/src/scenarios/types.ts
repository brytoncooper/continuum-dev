import type { NodeValue, ViewDefinition } from '@continuum/contract';

export type OutcomeSeverity = 'success' | 'warning' | 'danger' | 'info';

export interface OutcomeHint {
  severity: OutcomeSeverity;
  summary: string;
  detail?: string;
}

export interface ScenarioStep {
  id: string;
  label: string;
  description: string;
  narrativePrompt: string;
  view: ViewDefinition;
  initialState?: Record<string, NodeValue>;
  outcomeHint?: OutcomeHint;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  capabilityTag: string;
  steps: ScenarioStep[];
}
