import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

export const VERCEL_AI_SDK_DEMO_PATH = '/api/vercel-ai-sdk/demo';
export const VERCEL_AI_SDK_LEGACY_DEMO_PATH = '/api/vercel-ai-sdk-demo';
export const VERCEL_AI_SDK_LIVE_PATH = '/api/vercel-ai-sdk/chat';
export const VERCEL_AI_SDK_PROVIDERS_PATH = '/api/vercel-ai-sdk/providers';
export const VERCEL_AI_SDK_API_KEY_HEADER = 'x-demo-provider-api-key';

const SUPPORTED_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
  'action',
  'group',
  'row',
  'grid',
  'collection',
  'presentation',
]);

const SUPPORTED_NODE_TYPE_VALUES = [...SUPPORTED_NODE_TYPES];
const SCALAR_STATEFUL_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
]);

const continuumNodeOptionSchema = z
  .object({
    value: z.string(),
    label: z.string(),
  })
  .catchall(z.any());

const continuumNodeSchema = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum(SUPPORTED_NODE_TYPE_VALUES),
      key: z.string().min(1).optional(),
      label: z.string().min(1).optional(),
      dataType: z.string().min(1).optional(),
      placeholder: z.string().optional(),
      contentType: z.enum(['text', 'markdown']).optional(),
      content: z.string().optional(),
      intentId: z.string().optional(),
      options: z.array(continuumNodeOptionSchema).optional(),
      children: z.array(continuumNodeSchema).optional(),
      template: continuumNodeSchema.optional(),
    })
    .catchall(z.any())
);

export const CONTINUUM_VIEW_OUTPUT_SCHEMA = z
  .object({
    viewId: z.string().min(1),
    version: z.string().min(1),
    nodes: z.array(continuumNodeSchema),
  })
  .catchall(z.any());

const PROVIDER_CATALOG = [
  {
    id: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5-nano'],
    envKey: 'OPENAI_API_KEY',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    tokenLabel: 'Anthropic API key',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
    envKey: 'ANTHROPIC_API_KEY',
  },
];

const providerCatalogById = new Map(
  PROVIDER_CATALOG.map((provider) => [provider.id, provider])
);

function toCanonicalNodeId(nodeId, parentPath = '') {
  return parentPath ? `${parentPath}/${nodeId}` : nodeId;
}

function getNodeChildren(node) {
  if (!node || typeof node !== 'object') {
    return [];
  }

  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    return Array.isArray(node.children) ? node.children : [];
  }

  if (node.type === 'collection' && node.template) {
    return [node.template];
  }

  return [];
}

function mapOptionValue(options, rawValue) {
  if (!Array.isArray(options) || options.length === 0) {
    return undefined;
  }

  const normalized =
    typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : String(rawValue).trim().toLowerCase();

  const exactValue = options.find(
    (option) =>
      option &&
      typeof option.value === 'string' &&
      option.value.trim().toLowerCase() === normalized
  );
  if (exactValue) {
    return exactValue.value;
  }

  const exactLabel = options.find(
    (option) =>
      option &&
      typeof option.label === 'string' &&
      option.label.trim().toLowerCase() === normalized
  );
  if (exactLabel) {
    return exactLabel.value;
  }

  return undefined;
}

function coerceBooleanValue(rawValue) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    return rawValue !== 0;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on' ||
      normalized === 'enabled'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'off' ||
      normalized === 'disabled'
    ) {
      return false;
    }
  }

  return undefined;
}

function coerceNumberValue(rawValue) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.replace(/[$,%\s,]/g, '').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function unwrapNodeValueLike(rawValue) {
  if (
    rawValue &&
    typeof rawValue === 'object' &&
    'value' in rawValue &&
    Object.keys(rawValue).length <= 5
  ) {
    return rawValue.value;
  }

  return rawValue;
}

function coerceScalarStateValue(target, rawValue) {
  const value = unwrapNodeValueLike(rawValue);

  if (value === undefined || value === null) {
    return undefined;
  }

  if (target.nodeType === 'toggle') {
    return coerceBooleanValue(value);
  }

  if (
    target.nodeType === 'slider' ||
    (target.nodeType === 'field' && target.dataType === 'number')
  ) {
    return coerceNumberValue(value);
  }

  if (target.nodeType === 'field' && target.dataType === 'boolean') {
    return coerceBooleanValue(value);
  }

  if (target.nodeType === 'select' || target.nodeType === 'radio-group') {
    return mapOptionValue(target.options, value);
  }

  if (target.nodeType === 'field' && target.dataType === 'string') {
    return String(value);
  }

  if (target.nodeType === 'textarea' || target.nodeType === 'date') {
    return String(value);
  }

  return String(value);
}

function collectCollectionTemplateTargets(node, parentPath = '') {
  if (!node || typeof node !== 'object') {
    return [];
  }

  const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);

  if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
    return [
      {
        nodeId: canonicalNodeId,
        key: typeof node.key === 'string' ? node.key : undefined,
        nodeType: node.type,
        label: typeof node.label === 'string' ? node.label : undefined,
        dataType: typeof node.dataType === 'string' ? node.dataType : undefined,
        options: Array.isArray(node.options) ? node.options : undefined,
      },
    ];
  }

  return getNodeChildren(node).flatMap((child) =>
    collectCollectionTemplateTargets(child, canonicalNodeId)
  );
}

export function buildContinuumStateTargetCatalog(view) {
  if (!view || typeof view !== 'object' || !Array.isArray(view.nodes)) {
    return [];
  }

  const visit = (node, parentPath = '') => {
    if (!node || typeof node !== 'object') {
      return [];
    }

    const canonicalNodeId = toCanonicalNodeId(node.id, parentPath);

    if (node.type === 'collection') {
      return [
        {
          nodeId: canonicalNodeId,
          key: typeof node.key === 'string' ? node.key : undefined,
          nodeType: node.type,
          label: typeof node.label === 'string' ? node.label : undefined,
          minItems:
            typeof node.minItems === 'number' ? node.minItems : undefined,
          maxItems:
            typeof node.maxItems === 'number' ? node.maxItems : undefined,
          templateFields: collectCollectionTemplateTargets(node.template),
        },
      ];
    }

    if (SCALAR_STATEFUL_NODE_TYPES.has(node.type)) {
      return [
        {
          nodeId: canonicalNodeId,
          key: typeof node.key === 'string' ? node.key : undefined,
          nodeType: node.type,
          label: typeof node.label === 'string' ? node.label : undefined,
          dataType: typeof node.dataType === 'string' ? node.dataType : undefined,
          options: Array.isArray(node.options) ? node.options : undefined,
        },
      ];
    }

    return getNodeChildren(node).flatMap((child) =>
      visit(child, canonicalNodeId)
    );
  };

  return view.nodes.flatMap((node) => visit(node));
}

export function isVercelAiSdkDemoPath(pathname) {
  return (
    pathname === VERCEL_AI_SDK_DEMO_PATH ||
    pathname === VERCEL_AI_SDK_LEGACY_DEMO_PATH
  );
}

export function isVercelAiSdkLivePath(pathname) {
  return pathname === VERCEL_AI_SDK_LIVE_PATH;
}

export function isVercelAiSdkProvidersPath(pathname) {
  return pathname === VERCEL_AI_SDK_PROVIDERS_PATH;
}

export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

export function textErrorResponse(status, message, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'text/plain; charset=utf-8');
  }

  return new Response(message, {
    ...init,
    status,
    headers,
  });
}

export function methodNotAllowed(allowedMethods) {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: Array.isArray(allowedMethods)
        ? allowedMethods.join(', ')
        : allowedMethods,
    },
  });
}

export function getPublicProviderCatalog(env = {}) {
  return PROVIDER_CATALOG.map((provider) => ({
    id: provider.id,
    label: provider.label,
    tokenLabel: provider.tokenLabel,
    defaultModel: provider.defaultModel,
    models: provider.models,
    serverKeyAvailable:
      typeof env[provider.envKey] === 'string' &&
      env[provider.envKey].trim().length > 0,
  }));
}

export function resolveLiveProvider(args) {
  const provider = providerCatalogById.get(args.providerId);
  if (!provider) {
    throw new Error(`Unsupported provider "${String(args.providerId)}".`);
  }

  const requestKey =
    args.headers?.get(VERCEL_AI_SDK_API_KEY_HEADER)?.trim() ?? '';

  if (requestKey && /\s/.test(requestKey)) {
    throw new Error(
      `${provider.label} live mode expected an API key, but the supplied value contains whitespace. It looks like the prompt may have been pasted into the key field by mistake.`
    );
  }

  const envKey =
    typeof args.env?.[provider.envKey] === 'string'
      ? args.env[provider.envKey].trim()
      : '';
  const apiKey = requestKey || envKey;

  if (!apiKey) {
    throw new Error(
      `${provider.label} live mode requires an API key. Add one in the demo controls or configure ${provider.envKey} in the Worker.`
    );
  }

  const modelId =
    typeof args.model === 'string' && args.model.trim().length > 0
      ? args.model.trim()
      : provider.defaultModel;

  if (provider.id === 'openai') {
    const openai = createOpenAI({ apiKey });
    return {
      provider,
      modelId,
      languageModel: openai(modelId),
      keySource: requestKey ? 'request' : 'env',
    };
  }

  const anthropic = createAnthropic({ apiKey });
  return {
    provider,
    modelId,
    languageModel: anthropic(modelId),
    keySource: requestKey ? 'request' : 'env',
  };
}

export function textFromPart(part) {
  if (!part || typeof part !== 'object') {
    return '';
  }

  if (part.type === 'text' && typeof part.text === 'string') {
    return part.text;
  }

  return '';
}

export function extractLatestUserInstruction(messages) {
  if (!Array.isArray(messages)) {
    return '';
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== 'object' || message.role !== 'user') {
      continue;
    }

    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content.trim();
    }

    if (Array.isArray(message.parts)) {
      const combined = message.parts
        .map((part) => textFromPart(part))
        .join(' ')
        .trim();

      if (combined) {
        return combined;
      }
    }
  }

  return '';
}

function stripCodeFences(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2 && lines[0].startsWith('```')) {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
    lines.pop();
  }

  return lines.join('\n').trim();
}

function extractJsonCandidate(text) {
  const start = text.search(/[[{]/);
  if (start < 0) {
    return null;
  }

  const stack = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      stack.push('}');
      continue;
    }

    if (character === '[') {
      stack.push(']');
      continue;
    }

    if (character === '}' || character === ']') {
      const expected = stack.pop();
      if (expected !== character) {
        return null;
      }

      if (stack.length === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseJson(text) {
  const candidates = [text, stripCodeFences(text)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const extracted = extractJsonCandidate(candidate);
      if (!extracted) {
        continue;
      }

      try {
        return JSON.parse(extracted);
      } catch {
        continue;
      }
    }
  }

  return null;
}

function bumpVersion(version) {
  const asInt = Number(version);
  if (Number.isInteger(asInt) && String(asInt) === version) {
    return String(asInt + 1);
  }

  const suffixed = version.match(/^(.*?)(\d+)$/);
  if (suffixed) {
    return `${suffixed[1]}${Number(suffixed[2]) + 1}`;
  }

  return `${version}-next`;
}

function makeUniqueId(baseId, usedIds) {
  let candidate = baseId || 'node';
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId || 'node'}_${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeNode(input, usedIds) {
  const source =
    input && typeof input === 'object' ? { ...input } : { type: 'presentation' };
  const type =
    typeof source.type === 'string' && SUPPORTED_NODE_TYPES.has(source.type)
      ? source.type
      : 'presentation';
  const normalized = { ...source, type };

  normalized.id = makeUniqueId(
    typeof source.id === 'string' ? source.id : 'node',
    usedIds
  );

  if (type === 'field' && typeof source.dataType !== 'string') {
    normalized.dataType = 'string';
  }

  if (type === 'presentation') {
    if (
      typeof source.contentType !== 'string' ||
      (source.contentType !== 'text' && source.contentType !== 'markdown')
    ) {
      normalized.contentType = 'text';
    }

    if (typeof source.content !== 'string') {
      normalized.content = '';
    }
  }

  if (type === 'action') {
    if (typeof source.intentId !== 'string' || source.intentId.trim().length === 0) {
      normalized.intentId = `${normalized.id}.submit`;
    }

    if (typeof source.label !== 'string' || source.label.trim().length === 0) {
      normalized.label = 'Submit';
    }
  }

  if (type === 'group' || type === 'row' || type === 'grid') {
    const children = Array.isArray(source.children) ? source.children : [];
    normalized.children = children.map((child) => normalizeNode(child, usedIds));
    delete normalized.template;
  }

  if (type === 'collection') {
    const template =
      source.template && typeof source.template === 'object'
        ? source.template
        : { id: `${normalized.id}_item`, type: 'group', children: [] };
    normalized.template = normalizeNode(template, usedIds);
  }

  return normalized;
}

function normalizeViewDefinition(view) {
  const usedIds = new Set();

  return {
    viewId: view.viewId,
    version: view.version,
    nodes: (Array.isArray(view.nodes) ? view.nodes : []).map((node) =>
      normalizeNode(node, usedIds)
    ),
  };
}

function normalizePatchNode(input, fallbackId = 'node') {
  const source =
    input && typeof input === 'object' ? { ...input } : { type: 'presentation' };
  const type =
    typeof source.type === 'string' && SUPPORTED_NODE_TYPES.has(source.type)
      ? source.type
      : 'presentation';
  const normalized = { ...source, type };

  normalized.id =
    typeof source.id === 'string' && source.id.trim().length > 0
      ? source.id
      : fallbackId;

  if (type === 'field' && typeof source.dataType !== 'string') {
    normalized.dataType = 'string';
  }

  if (type === 'presentation') {
    if (
      typeof source.contentType !== 'string' ||
      (source.contentType !== 'text' && source.contentType !== 'markdown')
    ) {
      normalized.contentType = 'text';
    }

    if (typeof source.content !== 'string') {
      normalized.content = '';
    }
  }

  if (type === 'action') {
    if (typeof source.intentId !== 'string' || source.intentId.trim().length === 0) {
      normalized.intentId = `${normalized.id}.submit`;
    }

    if (typeof source.label !== 'string' || source.label.trim().length === 0) {
      normalized.label = 'Submit';
    }
  }

  if (type === 'group' || type === 'row' || type === 'grid') {
    const children = Array.isArray(source.children) ? source.children : [];
    normalized.children = children.map((child, index) =>
      normalizePatchNode(child, `${normalized.id}_${index + 1}`)
    );
    delete normalized.template;
  }

  if (type === 'collection') {
    const template =
      source.template && typeof source.template === 'object'
        ? source.template
        : { id: `${normalized.id}_item`, type: 'group', children: [] };
    normalized.template = normalizePatchNode(
      template,
      `${normalized.id}_item`
    );
  }

  return normalized;
}

function normalizePatchOperation(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const source = input;
  const op = typeof source.op === 'string' ? source.op : '';

  if (op === 'insert-node') {
    if (!source.node || typeof source.node !== 'object') {
      return null;
    }

    const position =
      source.position && typeof source.position === 'object'
        ? {
            ...(typeof source.position.index === 'number'
              ? { index: source.position.index }
              : {}),
            ...(typeof source.position.beforeId === 'string'
              ? { beforeId: source.position.beforeId }
              : {}),
            ...(typeof source.position.afterId === 'string'
              ? { afterId: source.position.afterId }
              : {}),
          }
        : undefined;

    return {
      op,
      ...(typeof source.parentId === 'string' ? { parentId: source.parentId } : {}),
      ...(source.parentId === null ? { parentId: null } : {}),
      ...(position && Object.keys(position).length > 0 ? { position } : {}),
      node: normalizePatchNode(source.node),
    };
  }

  if (op === 'replace-node') {
    if (typeof source.nodeId !== 'string' || !source.nodeId.trim()) {
      return null;
    }

    if (!source.node || typeof source.node !== 'object') {
      return null;
    }

    return {
      op,
      nodeId: source.nodeId,
      node: normalizePatchNode(source.node, source.nodeId),
    };
  }

  if (op === 'remove-node') {
    if (typeof source.nodeId !== 'string' || !source.nodeId.trim()) {
      return null;
    }

    return {
      op,
      nodeId: source.nodeId,
    };
  }

  return null;
}

function coercePatchResponse(value, fallbackView) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record =
    value.response && typeof value.response === 'object'
      ? value.response
      : value;
  const kind =
    typeof record.kind === 'string'
      ? record.kind
      : Array.isArray(record.operations)
        ? 'patch'
        : 'view';

  if (kind === 'patch') {
    if (!Array.isArray(record.operations) || record.operations.length === 0) {
      return null;
    }

    const operations = record.operations
      .map((operation) => normalizePatchOperation(operation))
      .filter(Boolean);

    if (operations.length === 0) {
      return null;
    }

    return {
      kind: 'patch',
      patch: {
        viewId:
          typeof record.viewId === 'string'
            ? record.viewId
            : fallbackView?.viewId,
        version:
          typeof record.version === 'string'
            ? record.version
            : fallbackView?.version
              ? bumpVersion(fallbackView.version)
              : '1',
        operations,
      },
    };
  }

  const view = coerceViewDefinition(
    record.view && typeof record.view === 'object' ? record.view : record,
    fallbackView
  );

  return view
    ? {
        kind: 'view',
        view,
      }
    : null;
}

function resolveStateTarget(targetCatalog, reference) {
  if (!reference || typeof reference !== 'object') {
    return null;
  }

  const preferredNodeId =
    typeof reference.nodeId === 'string' && reference.nodeId.trim().length > 0
      ? reference.nodeId.trim()
      : null;
  if (preferredNodeId) {
    const byNodeId = targetCatalog.find(
      (target) => target.nodeId === preferredNodeId
    );
    if (byNodeId) {
      return byNodeId;
    }
  }

  const preferredKey =
    typeof reference.key === 'string' && reference.key.trim().length > 0
      ? reference.key.trim()
      : null;
  if (preferredKey) {
    const byKey = targetCatalog.find((target) => target.key === preferredKey);
    if (byKey) {
      return byKey;
    }
  }

  return null;
}

function resolveCollectionTemplateTarget(collectionTarget, referenceKey) {
  if (!collectionTarget || !Array.isArray(collectionTarget.templateFields)) {
    return null;
  }

  const normalizedReference =
    typeof referenceKey === 'string' ? referenceKey.trim() : '';
  if (!normalizedReference) {
    return null;
  }

  return (
    collectionTarget.templateFields.find(
      (target) => target.nodeId === normalizedReference
    ) ??
    collectionTarget.templateFields.find(
      (target) => target.key === normalizedReference
    ) ??
    null
  );
}

function normalizeScalarStateUpdate(target, rawValue) {
  const value = coerceScalarStateValue(target, rawValue);
  if (value === undefined) {
    return null;
  }

  return {
    nodeId: target.nodeId,
    value: {
      value,
    },
  };
}

function normalizeCollectionStateUpdate(target, updateRecord) {
  const valueRecord =
    updateRecord &&
    typeof updateRecord === 'object' &&
    updateRecord.value &&
    typeof updateRecord.value === 'object'
      ? updateRecord.value
      : updateRecord;

  const rawItems = Array.isArray(valueRecord?.items)
    ? valueRecord.items
    : Array.isArray(updateRecord?.items)
      ? updateRecord.items
      : null;

  if (!rawItems) {
    return null;
  }

  const items = rawItems
    .map((rawItem) => {
      const source =
        rawItem && typeof rawItem === 'object'
          ? rawItem.values && typeof rawItem.values === 'object'
            ? rawItem.values
            : rawItem
          : null;

      if (!source) {
        return null;
      }

      const values = {};
      for (const [referenceKey, rawFieldValue] of Object.entries(source)) {
        const templateTarget = resolveCollectionTemplateTarget(
          target,
          referenceKey
        );
        if (!templateTarget) {
          continue;
        }

        const normalizedValue = coerceScalarStateValue(
          templateTarget,
          rawFieldValue
        );
        if (normalizedValue === undefined) {
          continue;
        }

        values[templateTarget.nodeId] = {
          value: normalizedValue,
        };
      }

      return Object.keys(values).length > 0 ? { values } : null;
    })
    .filter(Boolean);

  if (items.length === 0) {
    return null;
  }

  return {
    nodeId: target.nodeId,
    value: {
      value: {
        items,
      },
    },
  };
}

function coerceContinuumStateResponse(value, targetCatalog) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record =
    value.response && typeof value.response === 'object'
      ? value.response
      : value;

  const rawUpdates = Array.isArray(record.updates)
    ? record.updates
    : record.values && typeof record.values === 'object'
      ? Object.entries(record.values).map(([key, value]) => ({
          key,
          value,
        }))
      : null;

  if (!rawUpdates || rawUpdates.length === 0) {
    return null;
  }

  const updates = rawUpdates
    .map((rawUpdate) => {
      if (!rawUpdate || typeof rawUpdate !== 'object') {
        return null;
      }

      const target = resolveStateTarget(targetCatalog, rawUpdate);
      if (!target) {
        return null;
      }

      if (target.nodeType === 'collection') {
        return normalizeCollectionStateUpdate(target, rawUpdate);
      }

      return normalizeScalarStateUpdate(target, rawUpdate.value);
    })
    .filter(Boolean);

  if (updates.length === 0) {
    return null;
  }

  return {
    updates,
    status:
      typeof record.status === 'string' && record.status.trim().length > 0
        ? record.status.trim()
        : undefined,
  };
}

function coerceViewDefinition(value, fallbackView) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value.view && typeof value.view === 'object' ? value.view : value;
  if (!record || typeof record !== 'object') {
    return null;
  }

  if (!Array.isArray(record.nodes)) {
    return null;
  }

  return normalizeViewDefinition({
    viewId:
      typeof record.viewId === 'string'
        ? record.viewId
        : fallbackView?.viewId ?? 'generated_view',
    version:
      typeof record.version === 'string'
        ? record.version
        : fallbackView?.version
          ? bumpVersion(fallbackView.version)
          : '1',
    nodes: record.nodes,
  });
}

export function coerceContinuumViewDefinition(value, fallbackView) {
  return coerceViewDefinition(value, fallbackView);
}

export function parseContinuumViewDefinition(args) {
  const parsed = parseJson(args.text);
  return coerceViewDefinition(parsed, args.fallbackView);
}

export function parseContinuumModelResponse(args) {
  const parsed = parseJson(args.text);
  return coercePatchResponse(parsed, args.fallbackView);
}

export function parseContinuumStateResponse(args) {
  const parsed = parseJson(args.text);
  return coerceContinuumStateResponse(parsed, args.targetCatalog);
}

export function shouldPreferContinuumState(instruction) {
  const normalized = typeof instruction === 'string' ? instruction.trim() : '';
  if (!normalized) {
    return false;
  }

  const broadSignals =
    /\b(rework|redesign|rewrite|overhaul|transform|turn this into|make this (?:into|feel)|whole form|entire form|full form|from scratch|workflow|wizard|multi-step|stepper|mobile-first|less crowded|add a section|add a field|remove a field)\b/i;
  if (broadSignals.test(normalized)) {
    return false;
  }

  return /\b(populate|prepopulate|prefill|pre-fill|fill (?:out|in)|fill the form|seed .*data|sample data|autofill|auto-fill)\b/i.test(
    normalized
  );
}

export function shouldPreferContinuumPatch(instruction) {
  const normalized = typeof instruction === 'string' ? instruction.trim() : '';
  if (!normalized) {
    return false;
  }

  const broadSignals =
    /\b(rework|redesign|rewrite|overhaul|transform|turn this into|make this (?:into|feel)|whole form|entire form|full form|from scratch|workflow|wizard|multi-step|stepper|mobile-first|less crowded)\b/i;
  if (broadSignals.test(normalized)) {
    return false;
  }

  const localizedVerbs =
    /\b(add|insert|append|remove|delete|rename|change|update|replace|move|swap)\b/i;
  const localizedTargets =
    /\b(field|input|question|button|action|toggle|slider|select|radio|textarea|date|phone|email|address|zip|budget|timeline|name|notes?|section|group|row|column)\b/i;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return localizedVerbs.test(normalized) && (localizedTargets.test(normalized) || wordCount <= 12);
}

export function buildContinuumSystemPrompt(options = {}) {
  const mode =
    options.mode === 'patch'
      ? 'patch'
      : options.mode === 'state'
        ? 'state'
        : 'view';

  if (mode === 'patch') {
    return [
      'You author Continuum UI edits for a client-side reconciliation runtime.',
      'Return exactly one JSON object and nothing else.',
      'Do not wrap the JSON in markdown fences.',
      'Return a patch response, not a full view.',
      'Patch response shape: {"kind":"patch","viewId":"...","version":"...","operations":[...]}.',
      'Supported patch operations are insert-node, replace-node, and remove-node.',
      'insert-node requires parentId null for top-level inserts or a parent group/row/grid/template node id, plus a node payload and optional position.beforeId / position.afterId / position.index.',
      'replace-node requires nodeId and a full replacement node subtree.',
      'remove-node requires nodeId.',
      'For small edits like adding one field, return a minimal operation list.',
      'Supported node types are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
      'Every node must include id and type.',
      'Use key whenever semantic continuity matters.',
      'Preserve existing ids and keys for semantically unchanged fields whenever possible.',
      'For field nodes, include dataType when it is missing.',
      'For presentation nodes, include contentType and content.',
      'For action nodes, include intentId and label.',
      'Never return placeholder, incomplete, or partially redacted nodes.',
      'Keep structures valid, concise, and ready for reconciliation.',
    ].join('\n');
  }

  if (mode === 'state') {
    return [
      'You author Continuum data updates for a client-side session runtime.',
      'Return exactly one JSON object and nothing else.',
      'Do not wrap the JSON in markdown fences.',
      'Return a state response, not a view or patch response.',
      'State response shape: {"kind":"state","updates":[...],"status":"optional short summary"}.',
      'Each update must target an existing stateful node by semantic key when available, otherwise by nodeId.',
      'Update shape: {"key":"person.fullName","value":"Jordan Lee"} or {"nodeId":"profile/full_name","value":"Jordan Lee"}.',
      'For collections, target the collection node and provide {"value":{"items":[{...}]}}.',
      'Collection items should be plain objects keyed by template field key when available, otherwise by template field nodeId.',
      'Example collection update: {"key":"invoice.lineItems","value":{"items":[{"lineItem.description":"Professional Services","lineItem.quantity":1}]}}.',
      'Only update stateful nodes that should actually change.',
      'Do not invent new node ids or keys.',
      'Do not mutate view structure.',
      'Prefer filling empty fields and preserving already meaningful values unless the instruction explicitly asks to overwrite them.',
      'Keep the response concise and immediately usable by the client runtime.',
    ].join('\n');
  }

  return [
    'You author Continuum ViewDefinition JSON for a client-side reconciliation runtime.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Start the response with { and end the response with }.',
    'The object must be a full ViewDefinition with top-level keys: viewId, version, nodes.',
    'Return the full next view, not a partial fragment.',
    'Supported node types are: group, row, grid, collection, field, textarea, date, select, radio-group, slider, toggle, action, presentation.',
    'Every node must include id and type.',
    'Use key whenever semantic continuity matters.',
    'Preserve existing ids and keys for semantically unchanged fields whenever possible.',
    'If the user asks for a small change, evolve the current view instead of replacing the workflow wholesale.',
    'Prefer groups for sections, rows for a few short related fields, and collections for repeatable user-managed items.',
    'For field nodes, include dataType when it is missing.',
    'For presentation nodes, include contentType and content.',
    'For action nodes, include intentId and label.',
    'Never return placeholder, incomplete, or partially redacted nodes.',
    'Keep structures valid, concise, and ready for reconciliation.',
  ].join('\n');
}

export function buildContinuumUserPrompt(args, options = {}) {
  const mode =
    options.mode === 'patch'
      ? 'patch'
      : options.mode === 'state'
        ? 'state'
        : 'view';

  if (mode === 'patch') {
    const sections = [
      'Return the next Continuum edit as JSON only.',
      'Return kind="patch".',
      'Do not return a full view unless the current view is missing or unusable.',
      'Use the smallest operation list that correctly applies the user request.',
      '',
      'Current view:',
      JSON.stringify(args.currentView ?? null, null, 2),
      '',
      'Instruction:',
      args.instruction.trim(),
    ];

    return sections.join('\n');
  }

  if (mode === 'state') {
    const sections = [
      'Return the next Continuum state updates as JSON only.',
      'Return kind="state".',
      'Do not return a full view.',
      '',
      'State targets:',
      JSON.stringify(args.stateTargets ?? [], null, 2),
      '',
      'Current state values:',
      JSON.stringify(args.currentData ?? null, null, 2),
      '',
      'Instruction:',
      args.instruction.trim(),
    ];

    return sections.join('\n');
  }

  const sections = [
    'Return the next Continuum view as JSON only.',
    '',
    'Current view:',
    JSON.stringify(args.currentView ?? null, null, 2),
    '',
    'Instruction:',
    args.instruction.trim(),
  ];

  return sections.join('\n');
}

export function formatRouteError(error, fallbackMessage) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}
