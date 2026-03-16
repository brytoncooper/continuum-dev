import type { ViewNode } from '@continuum-dev/contract';

export type RestoreFamily = 'text' | 'number' | 'boolean' | 'choice';

export interface TargetNodeMatch {
  canonicalId: string;
  node: ViewNode;
  label?: string;
  parentLabel?: string;
  family: RestoreFamily;
}

export interface RestoreNodeCandidateTokens {
  label: Set<string>;
  parent: Set<string>;
  key: Set<string>;
  semanticKey: Set<string>;
  path: Set<string>;
  all: Set<string>;
}

export interface RestoreNodeCandidate extends TargetNodeMatch {
  tokens: RestoreNodeCandidateTokens;
}

export interface RestoreCandidateMatch {
  targetNodeId: string;
  targetLabel?: string;
  targetParentLabel?: string;
  targetSemanticKey?: string;
  targetKey?: string;
  score: number;
}
