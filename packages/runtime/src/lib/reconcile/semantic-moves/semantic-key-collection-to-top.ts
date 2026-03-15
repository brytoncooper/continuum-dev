import type { DataSnapshot } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';
import type { NodeResolutionAccumulator } from '../../types.js';
import { migratedDiff } from '../../reconciliation/differ/index.js';
import type { SemanticKeyLocation } from './semantic-key-locations.js';
import { readCollectionFirstItemValue } from '../collection-lens/collection-path-lens.js';
import { cloneNodeValue } from '../collection-lens/collection-state-normalizer.js';
import { planCollectionToTopMoves } from './semantic-key-move-planner.js';

export function applyCollectionToTopMoves(
  priorLocations: SemanticKeyLocation[],
  newLocations: SemanticKeyLocation[],
  priorData: DataSnapshot,
  ctx: ReconciliationContext,
  resolved: NodeResolutionAccumulator
): void {
  const intents = planCollectionToTopMoves(priorLocations, newLocations);
  const migratedNodes = new Set<string>();

  for (const intent of intents) {
    const source = intent.source;
    const target = intent.target;
    const priorCollectionNode = ctx.priorById.get(source.outerCollectionId);
    if (!priorCollectionNode || priorCollectionNode.type !== 'collection') {
      continue;
    }

    const extracted = readCollectionFirstItemValue(
      priorData,
      source.outerCollectionId,
      priorCollectionNode,
      source.pathChain
    );
    if (!extracted) {
      continue;
    }

    resolved.values[target.nodeId] = cloneNodeValue(extracted);
    if (!migratedNodes.has(target.nodeId)) {
      migratedNodes.add(target.nodeId);
      resolved.diffs.push(
        migratedDiff(target.nodeId, undefined, resolved.values[target.nodeId])
      );
    }
  }
}
