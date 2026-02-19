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
  hash?: string;
  stateType?: string;
  stateShape?: unknown;
  migrations?: MigrationRule[];
  children?: ComponentDefinition[];
}

export interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}
