import type { ComponentState, SchemaSnapshot } from '@continuum/contract';

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
  schema: SchemaSnapshot;
  initialState?: Record<string, ComponentState>;
  outcomeHint?: OutcomeHint;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  capabilityTag: string;
  steps: ScenarioStep[];
}

