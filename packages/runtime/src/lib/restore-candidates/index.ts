import type { DataSnapshot, DetachedValue, ViewNode } from '@continuum-dev/contract';
import type { RestoreCandidateMatch } from './types.js';
import { determineDetachedFamily } from './family.js';
import { collectCandidateNodes } from './collect.js';
import { scoreCandidate } from './scoring.js';

export * from './types.js';
export { findNodeByIdentity } from './identity.js';
export { determineDetachedFamily, determineNodeFamily } from './family.js';

/**
 * Searches the provided node tree for possible candidate nodes that a
 * detached value might belong to, using a heuristic fuzzy matching approach.
 * 
 * This logic does not auto-apply restore operations; it merely provides
 * suggestions that higher-level orchestration can surface for user review.
 */
export function findRestoreCandidates(
  nodes: ViewNode[],
  data: DataSnapshot,
  detachedValue: DetachedValue
): RestoreCandidateMatch[] {
  const family = determineDetachedFamily(detachedValue);
  if (!family) {
    return [];
  }

  const nodeCandidates = collectCandidateNodes(nodes, data)
    .filter((candidate) => candidate.family === family)
    .map((candidate) => ({
      targetNodeId: candidate.canonicalId,
      targetLabel: candidate.label,
      targetParentLabel: candidate.parentLabel,
      targetSemanticKey: candidate.node.semanticKey,
      targetKey: candidate.node.key,
      score: scoreCandidate(detachedValue, candidate),
    }))
    .filter((candidate) => candidate.score >= 12)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.targetNodeId.localeCompare(right.targetNodeId);
    });

  return nodeCandidates;
}
