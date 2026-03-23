import {
  indexTargets,
  parseJson,
  summarizeCurrentData,
  uniqueNonEmptyStrings,
} from './shared.mjs';

function catalogEndpointIds(catalog) {
  if (!catalog || !Array.isArray(catalog.endpoints)) {
    return [];
  }
  return catalog.endpoints
    .map((entry) =>
      entry && typeof entry.id === 'string' ? entry.id.trim() : ''
    )
    .filter(Boolean);
}

function findCatalogEndpoint(catalog, endpointId) {
  if (!catalog || !Array.isArray(catalog.endpoints) || !endpointId) {
    return null;
  }

  return (
    catalog.endpoints.find((entry) => entry && entry.id === endpointId) ?? null
  );
}

function normalizeIntegrationFieldShape(field) {
  if (!field || typeof field !== 'object') {
    return 'scalar';
  }
  if (field.shape === 'collection') {
    return 'collection';
  }
  if (field.shape === 'object') {
    return 'object';
  }
  return 'scalar';
}

function collectPersistedSemanticKeysFromFields(fields) {
  const keys = [];
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!field || typeof field !== 'object') {
      continue;
    }

    const shape = normalizeIntegrationFieldShape(field);

    if (shape === 'object' && Array.isArray(field.fields)) {
      keys.push(...collectPersistedSemanticKeysFromFields(field.fields));
      continue;
    }

    if (shape === 'collection') {
      if (
        typeof field.semanticKey === 'string' &&
        field.semanticKey.trim().length > 0
      ) {
        keys.push(field.semanticKey.trim());
      }
      if (Array.isArray(field.itemFields)) {
        keys.push(...collectPersistedSemanticKeysFromFields(field.itemFields));
      }
      continue;
    }

    if (
      typeof field.semanticKey === 'string' &&
      field.semanticKey.trim().length > 0
    ) {
      keys.push(field.semanticKey.trim());
    }
  }

  return uniqueNonEmptyStrings(keys);
}

function appendIntegrationFieldCatalogLines(
  field,
  depth,
  requiredLines,
  optionalLines
) {
  if (!field || typeof field !== 'object') {
    return;
  }

  const shape = normalizeIntegrationFieldShape(field);
  const pad = '  '.repeat(depth);
  const label =
    typeof field.label === 'string' && field.label.trim().length > 0
      ? field.label.trim()
      : typeof field.semanticKey === 'string'
      ? field.semanticKey.trim()
      : '';

  if (shape === 'object' && Array.isArray(field.fields)) {
    const key =
      typeof field.semanticKey === 'string' ? field.semanticKey.trim() : '';
    const header = `${pad}- [${label}]${
      key ? ` (${key})` : ''
    } — nested object${field.required ? ' [required]' : ' [optional]'}`;
    if (field.required) {
      requiredLines.push(header);
    } else {
      optionalLines.push(header);
    }
    for (const child of field.fields) {
      appendIntegrationFieldCatalogLines(
        child,
        depth + 1,
        requiredLines,
        optionalLines
      );
    }
    return;
  }

  if (shape === 'collection') {
    const key =
      typeof field.semanticKey === 'string' ? field.semanticKey.trim() : '';
    if (!key) {
      return;
    }
    const min =
      typeof field.minItems === 'number' ? ` minItems=${field.minItems}` : '';
    const max =
      typeof field.maxItems === 'number' ? ` maxItems=${field.maxItems}` : '';
    const header = `${pad}- ${key} (${label}) [collection]${min}${max}${
      field.required ? ' [required]' : ' [optional]'
    }`;
    if (field.required) {
      requiredLines.push(header);
    } else {
      optionalLines.push(header);
    }
    const subNote = `${pad}  Each row:`;
    if (field.required) {
      requiredLines.push(subNote);
    } else {
      optionalLines.push(subNote);
    }
    for (const child of Array.isArray(field.itemFields)
      ? field.itemFields
      : []) {
      appendIntegrationFieldCatalogLines(
        child,
        depth + 2,
        requiredLines,
        optionalLines
      );
    }
    return;
  }

  const key =
    typeof field.semanticKey === 'string' ? field.semanticKey.trim() : '';
  if (!key) {
    return;
  }
  const dt =
    typeof field.dataType === 'string' && field.dataType.trim().length > 0
      ? ` ${field.dataType.trim()}`
      : '';
  const enumNote =
    Array.isArray(field.enumValues) && field.enumValues.length > 0
      ? ` enum=${field.enumValues.join('|')}`
      : '';
  const desc =
    typeof field.description === 'string' && field.description.trim().length > 0
      ? ` — ${field.description.trim()}`
      : '';
  const line = `${pad}- ${key} (${label})${dt}${enumNote}${
    field.required ? ' [required]' : ' [optional]'
  }${desc}`;
  if (field.required) {
    requiredLines.push(line);
  } else {
    optionalLines.push(line);
  }
}

function registeredActionsEntries(registeredActions) {
  if (!registeredActions || typeof registeredActions !== 'object') {
    return [];
  }

  return Object.entries(registeredActions).filter(
    ([intentId]) => typeof intentId === 'string' && intentId.trim().length > 0
  );
}

/**
 * Paragraph listing `Session.getRegisteredActions()` for view authoring: valid
 * `intentId` values on `action` nodes.
 */
export function buildRegisteredActionsParagraph(args = {}) {
  const entries = registeredActionsEntries(args.registeredActions);
  if (entries.length === 0) {
    return '';
  }

  const lines = [
    'Runtime-registered action intents (use these intentId values on action nodes; the host app dispatches handlers for these ids):',
  ];

  for (const [intentId, reg] of entries) {
    const label =
      reg &&
      typeof reg === 'object' &&
      typeof reg.label === 'string' &&
      reg.label.trim().length > 0
        ? reg.label.trim()
        : intentId;
    const description =
      reg &&
      typeof reg === 'object' &&
      typeof reg.description === 'string' &&
      reg.description.trim().length > 0
        ? ` — ${reg.description.trim()}`
        : '';
    lines.push(`- ${intentId}: ${label}${description}`);
  }

  return lines.join('\n');
}

/**
 * Human-readable paragraph for view/state/patch prompts when an integration catalog is in play.
 */
export function buildIntegrationBindingParagraph(args = {}) {
  const catalog = args.integrationCatalog;
  const endpointId =
    typeof args.endpointId === 'string' ? args.endpointId.trim() : '';
  const endpoint = findCatalogEndpoint(catalog, endpointId);
  if (!catalog || !endpoint) {
    return '';
  }

  const productSummary =
    typeof catalog.productSummary === 'string'
      ? catalog.productSummary.trim()
      : '';

  const keys = Array.isArray(args.payloadSemanticKeys)
    ? uniqueNonEmptyStrings(args.payloadSemanticKeys)
    : [];
  const allowed = new Set(
    collectPersistedSemanticKeysFromFields(endpoint.persistedFields)
  );

  const focusKeys = keys.filter((key) => allowed.has(key));
  const requiredLines = [];
  const optionalLines = [];

  for (const field of Array.isArray(endpoint.persistedFields)
    ? endpoint.persistedFields
    : []) {
    appendIntegrationFieldCatalogLines(field, 0, requiredLines, optionalLines);
  }

  const method =
    typeof endpoint.method === 'string'
      ? endpoint.method.trim().toUpperCase()
      : '';
  const path = typeof endpoint.path === 'string' ? endpoint.path.trim() : '';

  const lines = [
    productSummary.length > 0 ? `Product context:\n${productSummary}` : '',
    'Execution planner binding: this endpoint and persisted key scope were chosen in the planner JSON plan for this run. Downstream steps do not re-select a different endpoint or schema.',
    'Hard constraint: Persisted values on field nodes must use only the semantic keys listed below for this endpoint. Do not introduce other persisted keys, alternate spellings, or fields that would not serialize to this HTTP contract.',
    'Accepted payload schema for this endpoint (persisted columns / request body shape). This is not a form template—design layout, grouping, and controls to match the user instruction.',
    `Endpoint id: ${endpoint.id}`,
    `HTTP: ${method} ${path}`,
    typeof endpoint.userAction === 'string' &&
    endpoint.userAction.trim().length > 0
      ? `Representative user action: ${endpoint.userAction.trim()}`
      : '',
    'Persisted fields (semantic keys must match these for saved data):',
    ...requiredLines,
    ...optionalLines,
  ];

  if (focusKeys.length > 0) {
    lines.push(
      'Planner focus — prioritize these semantic keys for stateful fields:',
      focusKeys.join(', ')
    );
  }

  lines.push(
    'Map user input only to the semantic keys listed above for persisted values. You may add presentation-only nodes; do not introduce additional persisted keys beyond this schema.'
  );

  return lines.filter((line) => line !== '').join('\n\n');
}

export function getAvailableContinuumExecutionModes(args = {}) {
  const availableModes = [];

  if (args.hasStateTargets) {
    availableModes.push('state');
  }

  if (args.hasCurrentView) {
    availableModes.push('patch');
    availableModes.push('transform');
  }

  availableModes.push('view');
  return availableModes;
}

export function buildContinuumExecutionPlannerSystemPrompt(args = {}) {
  const lines = [
    'You are a fast Continuum execution planner.',
    'Return exactly one JSON object and nothing else.',
    'Choose one mode from the provided availableModes array.',
    'Continuum product context:',
    '- The current view is a live UI the user is looking at and working on in a web browser.',
    '- The user is talking in messy natural language about what they want to happen on that current form.',
    '- Your job is not to invent system policy or redesign the whole app architecture. Your job is to choose the execution contract that best helps the user accomplish what they asked for on the current form.',
    '- Prefer preserving the current workflow and making the smallest useful change unless the request clearly implies broader change.',
    '- Treat valid modes as runtime contracts that implement user intent, not as the main goal.',
    'Response shape:',
    '{"mode":"patch","reason":"localized layout edit","fallback":"view","targetNodeIds":["email"],"targetSemanticKeys":["person.email"]}',
    'When mode="view", you may also include authoringMode="create-view" or authoringMode="evolve-view".',
    'Interpret the instruction as a request to the assistant, not as raw field input, unless the user is clearly asking to fill, prefill, populate, or overwrite existing values.',
    'Modes:',
    '- state: only update existing field values or collection data. No structural or layout change.',
    '- patch: apply a localized structural or layout edit to the existing view with targeted operations.',
    '- transform: generate the next view plus a deterministic continuity plan when prior values need explicit remapping.',
    '- view: generate the full next view when creating, rebuilding, or broadly reworking the form.',
    'Targeting rules:',
    '- For state or patch, include the smallest useful targetNodeIds and/or targetSemanticKeys drawn from the provided catalogs.',
    '- For transform, include targets when they are obvious, but a transform can still be valid without explicit localized targets.',
    '- Do not invent target ids or semantic keys.',
    '- Use semantic keys when they are available and meaningful for the request.',
    '- Use fallback="view" when patch, transform, or state would be unsafe if validation fails.',
    'Choose state only when the user is clearly asking for value changes on the current form, including populate, prefill, sample-data, and fill-out requests.',
    'Do not choose state just because a generic field like goal, notes, summary, or description could technically hold the sentence.',
    'If the user is describing the kind of form, workflow, or task they need, choose view.',
    'If the instruction introduces a new domain or workflow not already expressed by the current view, choose view.',
    'When choosing view for a new domain, new workflow, or broad rebuild, set authoringMode="create-view".',
    'When choosing view to broadly revise the current workflow while keeping it recognizably related, set authoringMode="evolve-view".',
    'Prefer patch for local edits like add/remove/move/rename/reorder one field or section.',
    'Prefer patch when the user wants more, less, shorter, cleaner, nicer, or better and the likely answer is a local UI adjustment rather than a new workflow.',
    'Prefer transform when the request merges fields, splits fields, repurposes existing data, or otherwise changes how prior values should flow into the next schema.',
    'Requests like "put these on one line", "make side by side", and "move this under that" are usually patch.',
    'Requests like "make first and last name into full name" or "split full name into first and last" are usually transform.',
    'Prefer state for fill, prefill, sample-data, and value-only changes.',
    'Prefer view for brand new forms, broad redesigns, workflow changes, or requests that reshape much of the form.',
    'Examples:',
    '- {"instruction":"Prefill this with Jordan Lee, jordan@example.com","mode":"state","fallback":"view","targetSemanticKeys":["person.fullName","person.email"]}',
    '- {"instruction":"Populate the email","mode":"state","fallback":"view","targetSemanticKeys":["person.email"]}',
    '- {"instruction":"Add a secondary email","mode":"patch","fallback":"view","targetSemanticKeys":["person.email"]}',
    '- {"instruction":"Make this shorter","mode":"patch","fallback":"view","targetNodeIds":["intro_section"]}',
    '- {"instruction":"Make it nicer","mode":"patch","fallback":"view","targetNodeIds":["contact_section"]}',
    '- {"instruction":"Put the email fields on one line","mode":"patch","fallback":"view","targetSemanticKeys":["person.email","person.secondaryEmail"]}',
    '- {"instruction":"Make first name and last name into full name","mode":"transform","fallback":"view","targetSemanticKeys":["person.fullName"]}',
    '- {"instruction":"I need to do my taxes","mode":"view","fallback":"view","authoringMode":"create-view"}',
    'If a mode is not available, do not choose it.',
    'Be decisive. Keep reason short.',
  ];

  if (args.hasRestoreContinuity) {
    lines.push(
      'Restore continuity context:',
      '- When the user refers to removed content, prior fields, "previous stuff", "you removed", or asks to bring back data, treat that as continuity restoration when detached fields or a recent conversation summary are provided.',
      '- Prefer patch or state to reintroduce fields or restore values when the current view and catalogs can support it, instead of replacing the whole form.',
      '- Prefer transform when prior values must be remapped across a structural schema change.'
    );
  }

  if (
    args.integrationCatalog &&
    catalogEndpointIds(args.integrationCatalog).length > 0
  ) {
    lines.push(
      'Integration catalog context (mandatory for this deployment):',
      '- The integrationCatalog JSON is the only allowed HTTP surface and persisted-field vocabulary. Generated UI and state updates must stay compatible with exactly one catalog endpoint per plan.',
      '- On this turn, the execution planner is the only authority that selects endpointId and payloadSemanticKeys. Downstream view, state, and patch prompts receive only the binding paragraph for that one endpoint; no later step re-chooses the endpoint or persisted schema.',
      '- You MUST include endpointId (exactly one id from integrationCatalog.endpoints[].id) and payloadSemanticKeys (non-empty; every entry must be an allowed semantic key for that endpoint: scalars, nested object leaf keys, collection keys, and collection item-template keys as defined in persistedFields, including shape=object, shape=collection, fields, and itemFields). Omitting either fails integration binding.',
      '- targetSemanticKeys (when you use them) must only reference semantic keys from that same endpoint schema. Do not invent keys outside that endpoint.',
      '- Do not plan workflows that require HTTP methods, paths, or persisted keys that are not listed for the chosen endpoint.',
      '- If the user mixes concerns, pick the single endpoint that best matches the primary request and keep payloadSemanticKeys within its schema; do not add imaginary backend operations or extra endpoints.',
      '- The integrationCatalog JSON block is not a prescribed form layout.',
      '- The normal Continuum plan fields (mode, targets, etc.) still apply; integration fields are additive.',
      '- Example with integration catalog:',
      '- {"mode":"view","fallback":"view","authoringMode":"create-view","endpointId":"client.profile.save","payloadSemanticKeys":["household.displayName","client.primaryEmail"],"reason":"update profile"}'
    );
  }

  if (registeredActionsEntries(args.registeredActions).length > 0) {
    lines.push(
      'Runtime actions context:',
      '- registeredActions lists intent ids registered on the host session (labels are for display).',
      '- When the user needs a submit or primary action, prefer an action node whose intentId appears in registeredActions.',
      '- Do not invent intentId strings that are not registered.'
    );
  }

  return lines.join('\n');
}

export function buildContinuumExecutionPlannerUserPrompt(args = {}) {
  const sections = [
    'Choose the best Continuum execution mode for this request.',
    'The user is in a browser session working on the current form below.',
    'They are describing what they want to happen next in natural language.',
    'You are deciding how Continuum should help with the current UI, not classifying abstract data-model operations in a vacuum.',
    'Assume the user is reacting to what they see on the current form unless the instruction clearly asks for a brand-new workflow.',
    'Do not treat the instruction as a literal field value unless it is clearly a fill/prefill request or a direct payload of values.',
    '',
  ];

  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):',
      args.conversationSummary.trim(),
      ''
    );
  }

  if (Array.isArray(args.detachedFields) && args.detachedFields.length > 0) {
    sections.push(
      'Detached fields (restore continuity):',
      JSON.stringify(args.detachedFields, null, 2),
      ''
    );
  }

  sections.push(
    'availableModes:',
    JSON.stringify(
      Array.isArray(args.availableModes) ? args.availableModes : []
    ),
    '',
    'Patch targets:',
    JSON.stringify(
      Array.isArray(args.patchTargets) ? args.patchTargets : [],
      null,
      2
    ),
    '',
    'State targets:',
    JSON.stringify(
      Array.isArray(args.stateTargets) ? args.stateTargets : [],
      null,
      2
    ),
    '',
    'Current view compact tree:',
    JSON.stringify(
      Array.isArray(args.compactTree) ? args.compactTree : [],
      null,
      2
    ),
    '',
    'Current populated values:',
    JSON.stringify(summarizeCurrentData(args.currentData), null, 2),
    ''
  );

  if (
    args.integrationCatalog &&
    catalogEndpointIds(args.integrationCatalog).length > 0
  ) {
    sections.push(
      'integrationCatalog (mandatory backend contract; follow integration rules in the system prompt):',
      JSON.stringify(args.integrationCatalog, null, 2),
      '',
      'Integration routing (output these fields in your JSON plan; downstream view and state authoring use only this binding):',
      '- endpointId: exactly one id from endpoints[].id above.',
      '- payloadSemanticKeys: non-empty array of persistedFields.semanticKey values for that endpoint; include keys you intend the form to persist (at least every required field).',
      '- Later steps do not re-select the endpoint or invent a different persisted schema; your choice here is the shared contract for this run.',
      ''
    );
  }

  if (registeredActionsEntries(args.registeredActions).length > 0) {
    sections.push(
      'registeredActions:',
      JSON.stringify(args.registeredActions, null, 2),
      ''
    );
  }

  sections.push(
    'Instruction:',
    typeof args.instruction === 'string' ? args.instruction.trim() : ''
  );

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
    typeof parsed.fallback === 'string' &&
    (parsed.fallback === 'patch' ||
      parsed.fallback === 'transform' ||
      parsed.fallback === 'view')
      ? parsed.fallback
      : 'view';

  const endpointIdRaw =
    typeof parsed.endpointId === 'string' ? parsed.endpointId.trim() : '';
  const payloadSemanticKeys = uniqueNonEmptyStrings(parsed.payloadSemanticKeys);

  const base = {
    mode,
    fallback,
    authoringMode:
      typeof parsed.authoringMode === 'string' &&
      (parsed.authoringMode === 'create-view' ||
        parsed.authoringMode === 'evolve-view')
        ? parsed.authoringMode
        : undefined,
    reason:
      typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : undefined,
    targetNodeIds: uniqueNonEmptyStrings(parsed.targetNodeIds),
    targetSemanticKeys: uniqueNonEmptyStrings(parsed.targetSemanticKeys),
  };

  if (endpointIdRaw.length > 0) {
    base.endpointId = endpointIdRaw;
  }

  if (payloadSemanticKeys.length > 0) {
    base.payloadSemanticKeys = payloadSemanticKeys;
  }

  return base;
}

function resolveIntegrationPlanFields(integrationCatalog, rawParsed) {
  if (
    !integrationCatalog ||
    catalogEndpointIds(integrationCatalog).length === 0
  ) {
    return {
      endpointId: undefined,
      payloadSemanticKeys: undefined,
      integrationValidation: 'not-applicable',
    };
  }

  if (!rawParsed || !rawParsed.endpointId) {
    return {
      endpointId: undefined,
      payloadSemanticKeys: undefined,
      integrationValidation: 'missing-endpoint',
    };
  }

  const endpoint = findCatalogEndpoint(
    integrationCatalog,
    rawParsed.endpointId
  );

  if (!endpoint) {
    return {
      endpointId: undefined,
      payloadSemanticKeys: undefined,
      integrationValidation: 'invalid-endpoint',
    };
  }

  const allowed = new Set(
    collectPersistedSemanticKeysFromFields(endpoint.persistedFields)
  );

  const requested = Array.isArray(rawParsed.payloadSemanticKeys)
    ? rawParsed.payloadSemanticKeys
    : [];
  const filtered = requested.filter((key) => allowed.has(key));
  const hadRequested = requested.length > 0;
  const partial = hadRequested && filtered.length < requested.length;

  let integrationValidation;
  if (partial) {
    integrationValidation = 'partial-payload-keys';
  } else if (allowed.size > 0 && filtered.length === 0) {
    integrationValidation = 'missing-payload-keys';
  } else {
    integrationValidation = 'accepted';
  }

  return {
    endpointId: rawParsed.endpointId,
    payloadSemanticKeys: filtered.length > 0 ? filtered : undefined,
    integrationValidation,
  };
}

function endpointAllowedSemanticKeys(catalog, endpointId) {
  const endpoint = findCatalogEndpoint(catalog, endpointId);
  if (!endpoint || !Array.isArray(endpoint.persistedFields)) {
    return new Set();
  }

  return new Set(
    collectPersistedSemanticKeysFromFields(endpoint.persistedFields)
  );
}

function mergeIntegrationIntoPlan(result, integrationCatalog, rawParsed) {
  const resolved = resolveIntegrationPlanFields(integrationCatalog, rawParsed);
  let targetSemanticKeys = Array.isArray(result.targetSemanticKeys)
    ? result.targetSemanticKeys
    : [];

  if (resolved.endpointId && integrationCatalog) {
    const allowed = endpointAllowedSemanticKeys(
      integrationCatalog,
      resolved.endpointId
    );

    if (allowed.size > 0) {
      targetSemanticKeys = targetSemanticKeys.filter((key) => allowed.has(key));
    }
  }

  return {
    ...result,
    endpointId: resolved.endpointId,
    payloadSemanticKeys: resolved.payloadSemanticKeys,
    integrationValidation: resolved.integrationValidation,
    targetSemanticKeys,
  };
}

export function resolveContinuumExecutionPlan(args = {}) {
  const availableModes = Array.isArray(args.availableModes)
    ? args.availableModes
    : [];
  const integrationCatalog = args.integrationCatalog;
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
    return mergeIntegrationIntoPlan(fallback, integrationCatalog, null);
  }

  const stateIndexes = indexTargets(args.stateTargets);
  const patchIndexes = indexTargets(args.patchTargets);
  const catalog = parsed.mode === 'state' ? stateIndexes : patchIndexes;

  if (parsed.mode === 'view') {
    return mergeIntegrationIntoPlan(
      {
        ...parsed,
        targetNodeIds: [],
        targetSemanticKeys: [],
        authoringMode: parsed.authoringMode ?? 'evolve-view',
        validation: 'accepted',
      },
      integrationCatalog,
      parsed
    );
  }

  if (parsed.mode === 'state' && !availableModes.includes('state')) {
    return mergeIntegrationIntoPlan(
      {
        ...fallback,
        reason: 'state unavailable',
        validation: 'state-unavailable',
      },
      integrationCatalog,
      parsed
    );
  }

  if (parsed.mode === 'patch' && !availableModes.includes('patch')) {
    return mergeIntegrationIntoPlan(
      {
        ...fallback,
        reason: 'patch unavailable',
        validation: 'patch-unavailable',
      },
      integrationCatalog,
      parsed
    );
  }

  if (parsed.mode === 'transform' && !availableModes.includes('transform')) {
    return mergeIntegrationIntoPlan(
      {
        ...fallback,
        reason: 'transform unavailable',
        validation: 'transform-unavailable',
      },
      integrationCatalog,
      parsed
    );
  }

  const matchedNodeIds = [];
  const matchedSemanticKeys = [];

  for (const nodeId of parsed.targetNodeIds) {
    if (catalog.byNodeId.has(nodeId)) {
      matchedNodeIds.push(nodeId);
    }
  }

  for (const semanticKey of parsed.targetSemanticKeys) {
    if (catalog.bySemanticKey.has(semanticKey)) {
      matchedSemanticKeys.push(semanticKey);
    }
  }

  const hadUnknownTargets =
    matchedNodeIds.length < parsed.targetNodeIds.length ||
    matchedSemanticKeys.length < parsed.targetSemanticKeys.length;

  if (
    parsed.mode !== 'transform' &&
    matchedNodeIds.length === 0 &&
    matchedSemanticKeys.length === 0
  ) {
    return mergeIntegrationIntoPlan(
      {
        ...parsed,
        targetNodeIds: [],
        targetSemanticKeys: [],
        reason: hadUnknownTargets
          ? 'no resolvable targets'
          : `${parsed.mode} requires explicit targets`,
        validation: hadUnknownTargets ? 'unknown-targets' : 'missing-targets',
      },
      integrationCatalog,
      parsed
    );
  }

  return mergeIntegrationIntoPlan(
    {
      ...parsed,
      targetNodeIds: matchedNodeIds,
      targetSemanticKeys: matchedSemanticKeys,
      validation: hadUnknownTargets ? 'partial-targets' : 'accepted',
    },
    integrationCatalog,
    parsed
  );
}
