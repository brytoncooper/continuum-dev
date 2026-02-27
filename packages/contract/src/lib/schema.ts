export interface SchemaSnapshot {
  schemaId: string;
  version: string;
  components: ComponentDefinition[];
}

export interface ComponentDefinition {
  id: string;
  type: string;
  key?: string;
  path?: string;
  label?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  hash?: string;
  stateType?: string;
  stateShape?: unknown;
  props?: Record<string, unknown>;
  defaultValue?: unknown;
  constraints?: ComponentConstraints;
  migrations?: MigrationRule[];
  children?: ComponentDefinition[];
}

export interface ComponentConstraints {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}
