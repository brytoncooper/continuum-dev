import { advanceContinuumViewVersion } from '@continuum-dev/protocol';
import { parseJson } from '../../view-guardrails/index.js';
import type { ViewLineDslNode } from './types.js';

export function bumpVersion(version: string): string {
  return advanceContinuumViewVersion(version, 'major');
}

function parseNumber(value: string | undefined): number | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseScalarValue(value: string | undefined): unknown {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed === 'true') {
    return true;
  }

  if (trimmed === 'false') {
    return false;
  }

  if (trimmed === 'null') {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    const parsed = parseJson<unknown>(trimmed);
    if (parsed !== null) {
      return parsed;
    }
  }

  return trimmed;
}

function readDefaultValueAttr(attrs: Record<string, string>): unknown {
  return parseScalarValue(attrs.defaultValue ?? attrs.value);
}

function readCollectionDefaultValuesAttr(
  attrs: Record<string, string>
): Array<Record<string, unknown>> | undefined {
  const raw = attrs.defaultValues;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  const parsed = parseJson<unknown>(raw);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  const items = parsed.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );

  return items.length > 0 ? items : undefined;
}

function collectCollectionItemDefaultValues(
  node: ViewLineDslNode
): Record<string, unknown> | undefined {
  const item: Record<string, unknown> = {};

  function visit(current: ViewLineDslNode): void {
    if (
      current.type === 'group' ||
      current.type === 'row' ||
      current.type === 'grid'
    ) {
      for (const child of current.children) {
        visit(child);
      }
      return;
    }

    if (current.type === 'collection' || current.type === 'action') {
      return;
    }

    const value = readDefaultValueAttr(current.attrs);
    if (typeof value === 'undefined') {
      return;
    }

    const key = current.attrs.key ?? current.attrs.id;
    if (typeof key === 'string' && key.trim().length > 0) {
      item[key] = value;
    }
  }

  visit(node);
  return Object.keys(item).length > 0 ? item : undefined;
}

function parseOptions(
  value: string | undefined
): Array<{ value: string; label: string }> | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const items = value
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf(':');
      if (separator < 0) {
        return {
          value: entry,
          label: entry,
        };
      }

      return {
        value: entry.slice(0, separator).trim(),
        label: entry.slice(separator + 1).trim(),
      };
    })
    .filter((option) => option.value.length > 0);

  return items.length > 0 ? items : undefined;
}

export function buildViewDefinitionNodeFromDsl(
  node: ViewLineDslNode,
  options?: {
    ignoreInlineDefaults?: boolean;
  }
): Record<string, unknown> {
  const attrs = node.attrs;
  const base: Record<string, unknown> = {
    id: attrs.id ?? `${node.type}_${Math.random().toString(36).slice(2, 8)}`,
    type: node.type,
  };

  if (attrs.key) base.key = attrs.key;
  if (attrs.semanticKey) base.semanticKey = attrs.semanticKey;
  if (attrs.label) base.label = attrs.label;
  if (attrs.description) base.description = attrs.description;
  if (attrs.placeholder) base.placeholder = attrs.placeholder;

  if (
    !options?.ignoreInlineDefaults &&
    node.type !== 'group' &&
    node.type !== 'row' &&
    node.type !== 'grid' &&
    node.type !== 'collection' &&
    node.type !== 'action'
  ) {
    const defaultValue = readDefaultValueAttr(attrs);
    if (typeof defaultValue !== 'undefined') {
      base.defaultValue = defaultValue;
    }
  }

  if (node.type === 'field') {
    base.dataType =
      attrs.dataType === 'number' || attrs.dataType === 'boolean'
        ? attrs.dataType
        : 'string';
  }

  if (node.type === 'presentation') {
    base.contentType = attrs.contentType === 'markdown' ? 'markdown' : 'text';
    base.content = attrs.content ?? '';
  }

  if (node.type === 'action') {
    base.intentId = attrs.intentId ?? `${String(base.id)}.submit`;
    if (!attrs.label) {
      base.label = 'Submit';
    }
  }

  if (node.type === 'grid') {
    const columns = parseNumber(attrs.columns);
    if (typeof columns === 'number') {
      base.columns = columns;
    }
  }

  if (node.type === 'group') {
    const layout = attrs.layout;
    if (layout === 'vertical' || layout === 'horizontal' || layout === 'grid') {
      base.layout = layout;
    }

    const columns = parseNumber(attrs.columns);
    if (typeof columns === 'number') {
      base.columns = columns;
    }
  }

  if (node.type === 'slider') {
    const min = parseNumber(attrs.min);
    const max = parseNumber(attrs.max);
    const step = parseNumber(attrs.step);
    if (typeof min === 'number') base.min = min;
    if (typeof max === 'number') base.max = max;
    if (typeof step === 'number') base.step = step;
  }

  if (node.type === 'select' || node.type === 'radio-group') {
    const options = parseOptions(attrs.options);
    if (options) {
      base.options = options;
    }
  }

  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    base.children = node.children.map((child) =>
      buildViewDefinitionNodeFromDsl(child, options)
    );
  }

  if (node.type === 'collection') {
    const templateNode = node.children[0];
    const explicitDefaultValues = readCollectionDefaultValuesAttr(attrs);
    const derivedDefaultItem = templateNode
      ? collectCollectionItemDefaultValues(templateNode)
      : undefined;

    if (explicitDefaultValues) {
      base.defaultValues = explicitDefaultValues;
    } else if (derivedDefaultItem) {
      base.defaultValues = [derivedDefaultItem];
    }

    base.template = templateNode
      ? buildViewDefinitionNodeFromDsl(templateNode, {
          ignoreInlineDefaults:
            Boolean(explicitDefaultValues) || Boolean(derivedDefaultItem),
        })
      : { id: `${String(base.id)}_item`, type: 'group', children: [] };
  }

  return base;
}
