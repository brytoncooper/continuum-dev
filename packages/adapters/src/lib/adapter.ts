import type { SchemaSnapshot, ComponentState } from '@continuum/contract';

export interface ProtocolAdapter<TExternalSchema, TExternalData = unknown> {
  name: string;
  toSchema(external: TExternalSchema): SchemaSnapshot;
  fromSchema?(snapshot: SchemaSnapshot): TExternalSchema;
  toState?(externalData: TExternalData): Record<string, ComponentState>;
  fromState?(state: Record<string, ComponentState>): TExternalData;
}
