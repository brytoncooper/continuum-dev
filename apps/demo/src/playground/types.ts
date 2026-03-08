import type { NodeValue, ViewDefinition } from '@continuum-dev/contract';

export interface PlaygroundScenarioStep {
  id: string;
  title: string;
  description: string;
  view: ViewDefinition;
}

export interface PlaygroundTrackedField {
  key: string;
  label: string;
}

export interface PlaygroundScenarioControls {
  inputLabel?: string;
  inputDescription?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  helperText: string;
}

export interface PlaygroundScenarioInputField {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}

interface PlaygroundScenarioBase {
  id: string;
  title: string;
  selectorLabel: string;
  problem: string;
  whyItMatters: string;
  steps: PlaygroundScenarioStep[];
  nextProblems: string[];
  inputFields?: PlaygroundScenarioInputField[];
  defaultInputValues?: Record<string, string>;
}

export interface PlaygroundStateDropScenario extends PlaygroundScenarioBase {
  kind: 'state-drop';
  trackedField: PlaygroundTrackedField;
  controls: PlaygroundScenarioControls;
}

export interface PlaygroundConflictScenario extends PlaygroundScenarioBase {
  kind: 'conflict-proposals';
  trackedFields: PlaygroundTrackedField[];
  initialValues: Record<string, NodeValue>;
  proposedValues: Record<string, NodeValue>;
  controls: PlaygroundScenarioControls;
}

export interface PlaygroundDetachedScenario extends PlaygroundScenarioBase {
  kind: 'detached-restore';
  trackedFields: PlaygroundTrackedField[];
  initialValues: Record<string, NodeValue>;
  detachedReasons: Record<string, 'node-removed' | 'type-mismatch'>;
  restoredKeys: string[];
  controls: PlaygroundScenarioControls;
}

export interface PlaygroundCollectionScenario extends PlaygroundScenarioBase {
  kind: 'collection-evolution';
  collectionNodeId: string;
  collectionKey: string;
  controls: PlaygroundScenarioControls;
  buildCollectionValue: (inputValues: Record<string, string>) => NodeValue;
}

export interface PlaygroundRecoveryScenario extends PlaygroundScenarioBase {
  kind: 'rewind-recovery';
  trackedFields: PlaygroundTrackedField[];
  initialValues: Record<string, NodeValue>;
  controls: PlaygroundScenarioControls;
}

export type PlaygroundScenario =
  | PlaygroundStateDropScenario
  | PlaygroundConflictScenario
  | PlaygroundDetachedScenario
  | PlaygroundCollectionScenario
  | PlaygroundRecoveryScenario;

export interface PlaygroundTrackedFieldState {
  key: string;
  label: string;
  nodeId: string | null;
  value: NodeValue | undefined;
}

export interface PlaygroundReplayState {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  trackedField: PlaygroundTrackedFieldState;
  status: string;
}

export interface PlaygroundConflictReplayState {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  trackedFields: PlaygroundTrackedFieldState[];
  status: string;
}

export interface PlaygroundDetachedReplayState {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  trackedFields: PlaygroundTrackedFieldState[];
  status: string;
}

export interface PlaygroundCollectionReplayState {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  itemCount: number;
  status: string;
}

export interface PlaygroundRecoveryReplayState {
  view: ViewDefinition;
  values: Record<string, NodeValue>;
  trackedFields: PlaygroundTrackedFieldState[];
  status: string;
}
