import type {
  CollectionNodeState,
  NodeValue,
} from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../../types.js';

export interface CollectionResolutionResult {
  value: NodeValue<CollectionNodeState>;
  issues: ReconciliationIssue[];
  didMigrateItems: boolean;
}
