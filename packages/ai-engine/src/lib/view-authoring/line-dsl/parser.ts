import type { ViewDefinition } from '@continuum-dev/core';
import {
  parseJson,
  sanitizeJsonViewDefinition,
} from '../../view-guardrails/index.js';
import {
  buildViewDefinitionNodeFromDsl,
  bumpVersion,
} from './node-definition.js';
import { normalizeViewLineDslText, parseAttrs } from './text.js';
import {
  CONTAINER_NODE_TYPES,
  isViewLineDslNodeType,
  type ViewLineDslNode,
} from './types.js';

export function parseViewLineDslToViewDefinition(args: {
  text: string;
  fallbackView?: ViewDefinition;
}): ViewDefinition | null {
  const asJson = parseJson<unknown>(args.text);
  if (asJson && typeof asJson === 'object') {
    const candidate = asJson as Record<string, unknown>;
    if (
      typeof candidate.viewId === 'string' &&
      typeof candidate.version === 'string' &&
      Array.isArray(candidate.nodes)
    ) {
      return sanitizeJsonViewDefinition(candidate as unknown as ViewDefinition);
    }
  }

  const normalized = normalizeViewLineDslText(args.text);
  if (!normalized) {
    return null;
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, '  '))
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0 || !lines[0].trim().startsWith('view ')) {
    return null;
  }

  const rootAttrs = parseAttrs(lines[0].trim().slice(5));
  const nodes: ViewLineDslNode[] = [];
  const stack: Array<{ indent: number; node: ViewLineDslNode }> = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const indentMatch = line.match(/^ */);
    const indent = indentMatch ? indentMatch[0].length / 2 : 0;
    const trimmed = line.trim();
    const firstSpace = trimmed.indexOf(' ');
    const typeToken = firstSpace >= 0 ? trimmed.slice(0, firstSpace) : trimmed;
    const rest = firstSpace >= 0 ? trimmed.slice(firstSpace + 1) : '';

    if (!isViewLineDslNodeType(typeToken)) {
      return null;
    }

    const node: ViewLineDslNode = {
      type: typeToken,
      attrs: parseAttrs(rest),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node;
    if (!parent) {
      nodes.push(node);
    } else {
      parent.children.push(node);
    }

    if (CONTAINER_NODE_TYPES.has(node.type)) {
      stack.push({ indent, node });
    }
  }

  const fallbackView = args.fallbackView;
  const viewId = rootAttrs.viewId ?? fallbackView?.viewId ?? 'generated_view';
  const version =
    rootAttrs.version ??
    (fallbackView ? bumpVersion(fallbackView.version) : '1');

  return {
    viewId,
    version,
    nodes: nodes.map((node) =>
      buildViewDefinitionNodeFromDsl(node)
    ) as unknown as ViewDefinition['nodes'],
  };
}
