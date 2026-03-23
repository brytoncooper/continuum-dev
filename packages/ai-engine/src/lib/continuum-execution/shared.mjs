const STATEFUL_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
  'collection',
]);

export function parseJson(text) {
  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    if (start < 0) {
      return null;
    }

    const stack = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < trimmed.length; index += 1) {
      const character = trimmed[index];

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
          try {
            return JSON.parse(trimmed.slice(start, index + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }

  return null;
}

export function uniqueNonEmptyStrings(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
    ),
  ];
}

export function toBoolean(value) {
  return value === true;
}

export function getChildNodes(node) {
  if (!node || typeof node !== 'object') {
    return [];
  }

  if (
    (node.type === 'group' || node.type === 'row' || node.type === 'grid') &&
    Array.isArray(node.children)
  ) {
    return node.children;
  }

  if (
    node.type === 'collection' &&
    node.template &&
    typeof node.template === 'object'
  ) {
    return [node.template];
  }

  return [];
}

function isStatefulNode(node) {
  return Boolean(
    node && typeof node === 'object' && STATEFUL_NODE_TYPES.has(node.type)
  );
}

export function collectStatefulEntries(nodes, parentPath = '', entries = []) {
  if (!Array.isArray(nodes)) {
    return entries;
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string') {
      continue;
    }

    const canonicalId = parentPath ? `${parentPath}/${node.id}` : node.id;
    if (isStatefulNode(node)) {
      entries.push({
        canonicalId,
        id: node.id,
        key: typeof node.key === 'string' ? node.key : undefined,
        semanticKey:
          typeof node.semanticKey === 'string' ? node.semanticKey : undefined,
        type: node.type,
      });
    }

    collectStatefulEntries(getChildNodes(node), canonicalId, entries);
  }

  return entries;
}

export function collectNodeEntries(nodes, parentPath = '', entries = []) {
  if (!Array.isArray(nodes)) {
    return entries;
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string') {
      continue;
    }

    const canonicalId = parentPath ? `${parentPath}/${node.id}` : node.id;
    entries.push({
      canonicalId,
      id: node.id,
      key: typeof node.key === 'string' ? node.key : undefined,
      semanticKey:
        typeof node.semanticKey === 'string' ? node.semanticKey : undefined,
      type: typeof node.type === 'string' ? node.type : undefined,
      label: typeof node.label === 'string' ? node.label : undefined,
    });
    collectNodeEntries(getChildNodes(node), canonicalId, entries);
  }

  return entries;
}

export function indexTargets(targets) {
  const byNodeId = new Map();
  const bySemanticKey = new Map();

  for (const target of Array.isArray(targets) ? targets : []) {
    if (!target || typeof target !== 'object') {
      continue;
    }

    if (typeof target.nodeId === 'string' && target.nodeId.trim().length > 0) {
      byNodeId.set(target.nodeId.trim(), target);
    }

    if (
      typeof target.semanticKey === 'string' &&
      target.semanticKey.trim().length > 0 &&
      !bySemanticKey.has(target.semanticKey.trim())
    ) {
      bySemanticKey.set(target.semanticKey.trim(), target);
    }
  }

  return {
    byNodeId,
    bySemanticKey,
  };
}

export function summarizeCurrentData(currentData, limit = 20) {
  if (!currentData || typeof currentData !== 'object') {
    return [];
  }

  return Object.entries(currentData)
    .filter(
      ([, entry]) => entry && typeof entry === 'object' && 'value' in entry
    )
    .slice(0, limit)
    .map(([nodeId, entry]) => {
      const rawValue = entry.value;
      let value = rawValue;
      if (typeof rawValue === 'string' && rawValue.length > 60) {
        value = `${rawValue.slice(0, 57)}...`;
      } else if (Array.isArray(rawValue)) {
        value = `[${rawValue.length} items]`;
      } else if (rawValue && typeof rawValue === 'object') {
        const keys = Object.keys(rawValue);
        value = `{${keys.slice(0, 4).join(', ')}${
          keys.length > 4 ? ', ...' : ''
        }}`;
      }

      return {
        nodeId,
        value,
        isDirty: toBoolean(entry.isDirty),
      };
    });
}

export function cloneView(view) {
  return structuredClone(view);
}

export function findNodeByCanonicalId(nodes, canonicalId, parentPath = '') {
  if (!Array.isArray(nodes)) {
    return null;
  }

  for (const node of nodes) {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string') {
      continue;
    }

    const currentId = parentPath ? `${parentPath}/${node.id}` : node.id;
    if (currentId === canonicalId) {
      return node;
    }

    const match = findNodeByCanonicalId(
      getChildNodes(node),
      canonicalId,
      currentId
    );
    if (match) {
      return match;
    }
  }

  return null;
}
