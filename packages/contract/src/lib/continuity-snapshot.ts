import type { ViewDefinition } from './view-definition.js';
import type { DataSnapshot } from './data-snapshot.js';

/**
 * Atomic pairing of a view schema and user-owned runtime data.
 */
export interface ContinuitySnapshot {
  /**
   * Current structural definition for the UI.
   */
  view: ViewDefinition;
  /**
   * Current user-owned data aligned to the view.
   */
  data: DataSnapshot;
}
