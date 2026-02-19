export interface StateSnapshot {
  values: Record<string, ComponentState>;
  meta: StateMeta;
  valuesMeta?: Record<string, ValueMeta>;
}

export type ComponentState =
  | ValueInputState
  | ToggleState
  | SelectionState
  | ViewportState
  | Record<string, unknown>;

export interface ValueInputState {
  value: string | number;
  isDirty?: boolean;
}

export interface ToggleState {
  checked: boolean;
}

export interface SelectionState {
  selectedIds: string[];
}

export interface ViewportState {
  scrollX: number;
  scrollY: number;
  expanded?: boolean;
}

export interface StateMeta {
  timestamp: number;
  sessionId: string;
  schemaId?: string;
  schemaVersion?: string;
  schemaHash?: string;
  lastInteractionId?: string;
}

export interface ValueMeta {
  lastUpdated?: number;
  lastInteractionId?: string;
}
