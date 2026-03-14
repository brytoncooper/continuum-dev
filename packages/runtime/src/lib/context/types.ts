import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import type { ReconciliationIssue } from '../types.js';

export interface ScopedNodeMatch {
  node: ViewNode;
  nodeId: string;
}

export interface ReconciliationContext {
  newView: ViewDefinition;
  priorView: ViewDefinition | null;
  newById: Map<string, ViewNode>;
  newByKey: Map<string, ViewNode>;
  newBySemanticKey: Map<string, ScopedNodeMatch>;
  priorById: Map<string, ViewNode>;
  priorByKey: Map<string, ViewNode>;
  priorBySemanticKey: Map<string, ScopedNodeMatch>;
  newNodeIds: WeakMap<ViewNode, string>;
  priorNodeIds: WeakMap<ViewNode, string>;
  newSemanticKeyCounts: Map<string, number>;
  priorSemanticKeyCounts: Map<string, number>;
  issues: ReconciliationIssue[];
}
