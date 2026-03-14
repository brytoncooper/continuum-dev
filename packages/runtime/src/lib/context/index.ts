export type { ReconciliationContext } from './types.js';
export { collectDuplicateIssues, buildReconciliationContext } from './indexing.js';
export {
  findPriorNode,
  determineNodeMatchStrategy,
  findNewNodeByPriorNode,
} from './matching.js';
export {
  buildPriorValueLookupByIdAndKey,
  resolvePriorSnapshotId,
} from './snapshot-values.js';
