import { getChildNodes, type ViewDefinition, type ViewNode } from '@continuum-dev/contract';
import type { TargetNodeMatch } from './types.js';
import { determineNodeFamily } from './family.js';
import { collectCandidateNodes } from './collect.js';

function normalizeLabel(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNodeLabel(node: ViewNode): string | undefined {
  return normalizeLabel(
    (node as unknown as Record<string, unknown>).label as string | undefined
  );
}

export function findNodeByIdentity(
  view: ViewDefinition,
  identity: {
    targetNodeId: string;
    targetSemanticKey?: string;
    targetKey?: string;
  }
): TargetNodeMatch | null {
  const matches: TargetNodeMatch[] = [];

  function visit(
    nodes: ViewNode[],
    parentPath = '',
    parentLabel?: string
  ): boolean {
    for (const node of nodes) {
      if (node.hidden) {
        continue;
      }

      const canonicalId =
        parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
      const label = readNodeLabel(node);
      const family = determineNodeFamily(node);

      if (canonicalId === identity.targetNodeId && family) {
        matches.push({
          canonicalId,
          node,
          label,
          parentLabel,
          family,
        });
        return true;
      }

      const children = getChildNodes(node);
      const nextParentLabel = label ?? parentLabel;
      if (
        children.length > 0 &&
        visit(children, canonicalId, nextParentLabel)
      ) {
        return true;
      }
    }

    return false;
  }

  if (visit(view.nodes)) {
    return matches[0] ?? null;
  }

  if (identity.targetSemanticKey) {
    const semanticMatches = collectCandidateNodes(view.nodes, {
      values: {},
      lineage: {
        timestamp: 0,
        sessionId: 'detached_restore_preview',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).filter(
      (candidate) => candidate.node.semanticKey === identity.targetSemanticKey
    );

    if (semanticMatches.length === 1) {
      const match = semanticMatches[0];
      return {
        canonicalId: match.canonicalId,
        node: match.node,
        label: match.label,
        parentLabel: match.parentLabel,
        family: match.family,
      };
    }
  }

  if (identity.targetKey) {
    const keyMatches = collectCandidateNodes(view.nodes, {
      values: {},
      lineage: {
        timestamp: 0,
        sessionId: 'detached_restore_preview',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).filter((candidate) => candidate.node.key === identity.targetKey);

    if (keyMatches.length === 1) {
      const match = keyMatches[0];
      return {
        canonicalId: match.canonicalId,
        node: match.node,
        label: match.label,
        parentLabel: match.parentLabel,
        family: match.family,
      };
    }
  }

  return null;
}
