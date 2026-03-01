import type { ViewDefinition } from './view-definition.js';
import type { DataSnapshot } from './data-snapshot.js';

export interface ContinuitySnapshot {
  view: ViewDefinition;
  data: DataSnapshot;
}
