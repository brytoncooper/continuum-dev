import {
  getChildNodes,
  type DataSnapshot,
  isProtectedNodeValue,
  type ViewNode,
} from '@continuum-dev/contract';
import type { RestoreNodeCandidate } from './types.js';
import { determineNodeFamily } from './family.js';
import { mergeTokenSets, tokenize } from './tokenizer.js';

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

function readNodeKey(node: ViewNode): string | undefined {
  return normalizeLabel(node.key);
}

function readNodeSemanticKey(node: ViewNode): string | undefined {
  return normalizeLabel(node.semanticKey);
}

function isProtectedValue(value: unknown): boolean {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return isProtectedNodeValue(
      value as {
        isDirty?: boolean;
        protection?: {
          owner: 'ai' | 'user';
          stage: 'flexible' | 'reviewed' | 'locked' | 'submitted';
        };
      }
    );
  }
  return false;
}

export function collectCandidateNodes(
  nodes: ViewNode[],
  data: DataSnapshot,
  parentPath = '',
  parentLabel?: string,
  output: RestoreNodeCandidate[] = []
): RestoreNodeCandidate[] {
  for (const node of nodes) {
    if (node.hidden) {
      continue;
    }

    const family = determineNodeFamily(node);
    const canonicalId =
      parentPath.length > 0 ? `${parentPath}/${node.id}` : node.id;
    const label = readNodeLabel(node);
    const key = readNodeKey(node);
    const semanticKey = readNodeSemanticKey(node);

    if (family && !isProtectedValue(data.values?.[canonicalId])) {
      const labelTokens = tokenize(label);
      const parentTokens = tokenize(parentLabel);
      const keyTokens = tokenize(key);
      const semanticTokens = tokenize(semanticKey);
      const pathTokens = tokenize(canonicalId);

      output.push({
        canonicalId,
        node,
        label,
        parentLabel,
        family,
        tokens: {
          label: labelTokens,
          parent: parentTokens,
          key: keyTokens,
          semanticKey: semanticTokens,
          path: pathTokens,
          all: mergeTokenSets(
            labelTokens,
            parentTokens,
            keyTokens,
            semanticTokens,
            pathTokens
          ),
        },
      });
    }

    const childLabel = label ?? parentLabel;
    const children = getChildNodes(node);
    if (children.length > 0) {
      collectCandidateNodes(children, data, canonicalId, childLabel, output);
    }
  }

  return output;
}
