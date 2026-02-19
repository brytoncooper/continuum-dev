import { SchemaSnapshot } from './schema.js';
import { StateSnapshot } from './state.js';

export interface ContinuitySnapshot {
  schema: SchemaSnapshot;
  state: StateSnapshot;
}
