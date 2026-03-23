import type { ViewDefinition } from '@continuum-dev/core';
import {
  MAX_NODE_HINTS,
  toCompactPatchNode,
  truncateString,
  truncateUnknown,
} from './truncate.js';
import type { PatchContextPayload, PatchNodeHint } from './types.js';

export function buildPatchContext(view: ViewDefinition): PatchContextPayload {
  const nodeHints: PatchNodeHint[] = [];

  const walkHints = (
    nodes: unknown[],
    parentPath: string,
    parentNodePath?: string
  ): void => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        continue;
      }

      const asRecord = node as Record<string, unknown>;
      const id =
        typeof asRecord.id === 'string' && asRecord.id.length > 0
          ? asRecord.id
          : 'node';
      const path = parentPath.length > 0 ? `${parentPath}/${id}` : id;

      nodeHints.push({
        path,
        id,
        parentPath: parentNodePath,
        key: typeof asRecord.key === 'string' ? asRecord.key : undefined,
        semanticKey:
          typeof asRecord.semanticKey === 'string'
            ? asRecord.semanticKey
            : undefined,
        type: typeof asRecord.type === 'string' ? asRecord.type : undefined,
        label:
          typeof asRecord.label === 'string'
            ? truncateString(asRecord.label)
            : undefined,
        description:
          typeof asRecord.description === 'string'
            ? truncateString(asRecord.description)
            : undefined,
        columns:
          typeof asRecord.columns === 'number' ? asRecord.columns : undefined,
        layout:
          typeof asRecord.layout === 'string' ? asRecord.layout : undefined,
        defaultValue:
          typeof asRecord.defaultValue !== 'undefined'
            ? truncateUnknown(asRecord.defaultValue)
            : undefined,
        childrenCount: Array.isArray(asRecord.children)
          ? asRecord.children.length
          : undefined,
        hasTemplate:
          !!asRecord.template && typeof asRecord.template === 'object',
      });

      if (Array.isArray(asRecord.children)) {
        walkHints(asRecord.children, path, path);
      }

      if (asRecord.template && typeof asRecord.template === 'object') {
        walkHints([asRecord.template], path, path);
      }
    }
  };

  walkHints(view.nodes as unknown[], '', undefined);

  return {
    nodeHints: nodeHints.slice(0, MAX_NODE_HINTS),
    compactTree: (view.nodes as unknown[]).map((node) =>
      toCompactPatchNode(node)
    ),
  };
}
