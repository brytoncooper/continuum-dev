import type { ViewDefinition } from '@continuum-dev/core';
import { parse as parseYaml } from 'yaml';
import { parseJson } from '../../view-guardrails/index.js';
import { extractMarkdownCodeBlock, stripCodeFences } from './markdown.js';
import { bumpVersion } from './shared.js';

function parseYamlValue<T>(text: string): T | null {
  try {
    return parseYaml(text) as T;
  } catch {
    return null;
  }
}

function coerceYamlViewDefinition(
  value: unknown,
  fallbackView?: ViewDefinition
): ViewDefinition | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const root =
    candidate.view && typeof candidate.view === 'object'
      ? (candidate.view as Record<string, unknown>)
      : candidate;

  const viewId =
    typeof root.viewId === 'string'
      ? root.viewId
      : fallbackView?.viewId ?? 'generated_view';
  const version =
    typeof root.version === 'string'
      ? root.version
      : fallbackView
      ? bumpVersion(fallbackView.version)
      : '1';
  const nodes = Array.isArray(root.nodes)
    ? (root.nodes as ViewDefinition['nodes'])
    : null;

  if (!nodes) {
    return null;
  }

  return {
    viewId,
    version,
    nodes,
  };
}

export function parseViewYamlToViewDefinition(args: {
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
      return candidate as unknown as ViewDefinition;
    }
  }

  const yamlBlock =
    extractMarkdownCodeBlock(args.text, ['yaml', 'yml']) ??
    stripCodeFences(args.text);
  const asYaml = parseYamlValue<unknown>(yamlBlock);
  return coerceYamlViewDefinition(asYaml, args.fallbackView);
}
