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

function parseJson(text) {
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

function uniqueNonEmptyStrings(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim()))];
}

function toBoolean(value) {
  return value === true;
}

function getChildNodes(node) {
  if (!node || typeof node !== 'object') {
    return [];
  }

  if (
    (node.type === 'group' || node.type === 'row' || node.type === 'grid') &&
    Array.isArray(node.children)
  ) {
    return node.children;
  }

  if (node.type === 'collection' && node.template && typeof node.template === 'object') {
    return [node.template];
  }

  return [];
}

function isStatefulNode(node) {
  return Boolean(node && typeof node === 'object' && STATEFUL_NODE_TYPES.has(node.type));
}

function collectStatefulEntries(nodes, parentPath = '', entries = []) {
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

function collectNodeEntries(nodes, parentPath = '', entries = []) {
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

function indexTargets(targets) {
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

function summarizeCurrentData(currentData, limit = 20) {
  if (!currentData || typeof currentData !== 'object') {
    return [];
  }

  return Object.entries(currentData)
    .filter(([, entry]) => entry && typeof entry === 'object' && 'value' in entry)
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
        value = `{${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', ...' : ''}}`;
      }

      return {
        nodeId,
        value,
        isDirty: toBoolean(entry.isDirty),
      };
    });
}

export function getAvailableContinuumExecutionModes(args = {}) {
  const availableModes = [];

  if (args.hasStateTargets) {
    availableModes.push('state');
  }

  if (args.hasCurrentView) {
    availableModes.push('patch');
  }

  availableModes.push('view');
  return availableModes;
}

export function buildContinuumExecutionPlannerSystemPrompt() {
  return [
    'You are a fast Continuum execution planner.',
    'Return exactly one JSON object and nothing else.',
    'Choose one mode from the provided availableModes array.',
    'Response shape:',
    '{"mode":"patch","reason":"localized layout edit","fallback":"view","targetNodeIds":["email"],"targetSemanticKeys":["person.email"]}',
    'Interpret the instruction as a request to the assistant, not as raw field input, unless the user is clearly asking to fill, prefill, populate, or overwrite existing values.',
    'Modes:',
    '- state: only update existing field values or collection data. No structural or layout change.',
    '- patch: apply a localized structural or layout edit to the existing view with targeted operations.',
    '- view: generate the full next view when creating, rebuilding, or broadly reworking the form.',
    'Targeting rules:',
    '- For state or patch, include the smallest useful targetNodeIds and/or targetSemanticKeys drawn from the provided catalogs.',
    '- Do not invent target ids or semantic keys.',
    '- Use semantic keys when they are available and meaningful for the request.',
    '- Use fallback="view" when patch or state would be unsafe if validation fails.',
    'Choose state only when the user is clearly providing data for the current form or asking the assistant to populate it.',
    'Do not choose state just because a generic field like goal, notes, summary, or description could technically hold the sentence.',
    'If the user is describing the kind of form, workflow, or task they need, choose view.',
    'If the instruction introduces a new domain or workflow not already expressed by the current view, choose view.',
    'Prefer patch for local edits like add/remove/move/rename/reorder one field or section.',
    'Requests like "put these on one line", "make side by side", and "move this under that" are usually patch.',
    'Prefer state for fill/prefill/sample data/value-only changes.',
    'Prefer view for brand new forms, broad redesigns, workflow changes, or requests that reshape much of the form.',
    'Examples:',
    '- {"instruction":"Prefill this with Jordan Lee, jordan@example.com","mode":"state","fallback":"view","targetSemanticKeys":["person.fullName","person.email"]}',
    '- {"instruction":"Add a secondary email","mode":"patch","fallback":"view","targetSemanticKeys":["person.email"]}',
    '- {"instruction":"Put the email fields on one line","mode":"patch","fallback":"view","targetSemanticKeys":["person.email","person.secondaryEmail"]}',
    '- {"instruction":"I need to do my taxes","mode":"view","fallback":"view"}',
    'If a mode is not available, do not choose it.',
    'Be decisive. Keep reason short.',
  ].join('\n');
}

export function buildContinuumExecutionPlannerUserPrompt(args = {}) {
  const sections = [
    'Choose the best Continuum execution mode for this request.',
    'The user is talking to the assistant about what should happen next.',
    'Do not treat the instruction as a literal field value unless it is clearly a fill/prefill request or a direct payload of values.',
    '',
    'availableModes:',
    JSON.stringify(Array.isArray(args.availableModes) ? args.availableModes : []),
    '',
    'Patch targets:',
    JSON.stringify(Array.isArray(args.patchTargets) ? args.patchTargets : [], null, 2),
    '',
    'State targets:',
    JSON.stringify(Array.isArray(args.stateTargets) ? args.stateTargets : [], null, 2),
    '',
    'Current view compact tree:',
    JSON.stringify(Array.isArray(args.compactTree) ? args.compactTree : [], null, 2),
    '',
    'Current populated values:',
    JSON.stringify(summarizeCurrentData(args.currentData), null, 2),
    '',
    'Instruction:',
    typeof args.instruction === 'string' ? args.instruction.trim() : '',
  ];

  return sections.join('\n');
}

export function parseContinuumExecutionPlan(args = {}) {
  const parsed = parseJson(args.text);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const availableModes = Array.isArray(args.availableModes)
    ? args.availableModes
    : [];
  const mode = typeof parsed.mode === 'string' ? parsed.mode.trim() : '';
  if (!availableModes.includes(mode)) {
    return null;
  }

  const fallback =
    typeof parsed.fallback === 'string' && (parsed.fallback === 'patch' || parsed.fallback === 'view')
      ? parsed.fallback
      : 'view';

  return {
    mode,
    fallback,
    reason:
      typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : undefined,
    targetNodeIds: uniqueNonEmptyStrings(parsed.targetNodeIds),
    targetSemanticKeys: uniqueNonEmptyStrings(parsed.targetSemanticKeys),
  };
}

export function resolveContinuumExecutionPlan(args = {}) {
  const availableModes = Array.isArray(args.availableModes)
    ? args.availableModes
    : [];
  const fallback = {
    mode: 'view',
    fallback: 'view',
    reason: 'planner fallback',
    targetNodeIds: [],
    targetSemanticKeys: [],
    validation: 'invalid-plan',
  };

  const parsed = parseContinuumExecutionPlan({
    text: args.text,
    availableModes,
  });

  if (!parsed) {
    return fallback;
  }

  const stateIndexes = indexTargets(args.stateTargets);
  const patchIndexes = indexTargets(args.patchTargets);
  const catalog = parsed.mode === 'state' ? stateIndexes : patchIndexes;

  if (parsed.mode === 'view') {
    return {
      ...parsed,
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'accepted',
    };
  }

  if (parsed.mode === 'state' && !availableModes.includes('state')) {
    return {
      ...fallback,
      reason: 'state unavailable',
      validation: 'state-unavailable',
    };
  }

  if (parsed.mode === 'patch' && !availableModes.includes('patch')) {
    return {
      ...fallback,
      reason: 'patch unavailable',
      validation: 'patch-unavailable',
    };
  }

  const matchedNodeIds = [];
  const matchedSemanticKeys = [];

  for (const nodeId of parsed.targetNodeIds) {
    if (!catalog.byNodeId.has(nodeId)) {
      return {
        ...fallback,
        reason: `unknown target ${nodeId}`,
        validation: 'unknown-target-node',
      };
    }
    matchedNodeIds.push(nodeId);
  }

  for (const semanticKey of parsed.targetSemanticKeys) {
    if (!catalog.bySemanticKey.has(semanticKey)) {
      return {
        ...fallback,
        reason: `unknown semantic target ${semanticKey}`,
        validation: 'unknown-target-semantic-key',
      };
    }
    matchedSemanticKeys.push(semanticKey);
  }

  if (matchedNodeIds.length === 0 && matchedSemanticKeys.length === 0) {
    return {
      ...fallback,
      reason: `${parsed.mode} requires explicit targets`,
      validation: 'missing-targets',
    };
  }

  return {
    ...parsed,
    targetNodeIds: matchedNodeIds,
    targetSemanticKeys: matchedSemanticKeys,
    validation: 'accepted',
  };
}

function cloneView(view) {
  return structuredClone(view);
}

function findNodeByCanonicalId(nodes, canonicalId, parentPath = '') {
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

    const match = findNodeByCanonicalId(getChildNodes(node), canonicalId, currentId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function normalizeContinuumSemanticIdentity(args = {}) {
  const currentView = args.currentView;
  const nextView = args.nextView;

  if (!currentView || !nextView || !Array.isArray(nextView.nodes)) {
    return {
      view: nextView,
      errors: [],
    };
  }

  const priorEntries = collectStatefulEntries(currentView.nodes);
  const nextEntries = collectStatefulEntries(nextView.nodes);
  const errors = [];
  const clone = cloneView(nextView);

  const priorBySemanticKey = new Map();
  const nextBySemanticKey = new Map();
  const priorByKey = new Map();
  const usedIds = new Set(collectNodeEntries(clone.nodes).map((entry) => entry.id));

  for (const entry of priorEntries) {
    if (entry.semanticKey && !priorBySemanticKey.has(entry.semanticKey)) {
      priorBySemanticKey.set(entry.semanticKey, entry);
    }
    if (entry.key && entry.semanticKey && !priorByKey.has(entry.key)) {
      priorByKey.set(entry.key, entry);
    }
  }

  for (const entry of nextEntries) {
    if (!entry.semanticKey) {
      continue;
    }

    if (nextBySemanticKey.has(entry.semanticKey)) {
      errors.push(`Duplicate semanticKey "${entry.semanticKey}" in generated view.`);
      continue;
    }
    nextBySemanticKey.set(entry.semanticKey, entry);
  }

  for (const entry of nextEntries) {
    if (entry.semanticKey) {
      const prior = priorBySemanticKey.get(entry.semanticKey);
      if (!prior || prior.id === entry.id) {
        continue;
      }

      if (usedIds.has(prior.id) && prior.id !== entry.id) {
        errors.push(
          `Generated view reused semanticKey "${entry.semanticKey}" but changed the node id from "${prior.id}" to "${entry.id}" while "${prior.id}" is already occupied.`
        );
        continue;
      }

      const targetNode = findNodeByCanonicalId(clone.nodes, entry.canonicalId);
      if (targetNode) {
        usedIds.delete(entry.id);
        targetNode.id = prior.id;
        usedIds.add(prior.id);
      }
      continue;
    }

    if (!entry.key) {
      continue;
    }

    const prior = priorByKey.get(entry.key);
    if (!prior) {
      continue;
    }

    errors.push(
      `Generated view reused "${entry.key}" without preserving semanticKey "${prior.semanticKey}".`
    );
  }

  return {
    view: clone,
    errors,
  };
}
