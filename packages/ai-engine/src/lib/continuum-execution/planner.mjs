import {
  indexTargets,
  parseJson,
  summarizeCurrentData,
  uniqueNonEmptyStrings,
} from './shared.mjs';

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
    'availableModes:',
    JSON.stringify(Array.isArray(args.availableModes) ? args.availableModes : []),
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
    JSON.stringify(Array.isArray(args.compactTree) ? args.compactTree : [], null, 2),
    '',
    'Current populated values:',
    JSON.stringify(summarizeCurrentData(args.currentData), null, 2),
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

  return {
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
      authoringMode: parsed.authoringMode ?? 'evolve-view',
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

  if (parsed.mode === 'transform' && !availableModes.includes('transform')) {
    return {
      ...fallback,
      reason: 'transform unavailable',
      validation: 'transform-unavailable',
    };
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
    return {
      ...parsed,
      targetNodeIds: [],
      targetSemanticKeys: [],
      reason: hadUnknownTargets
        ? 'no resolvable targets'
        : `${parsed.mode} requires explicit targets`,
      validation: hadUnknownTargets ? 'unknown-targets' : 'missing-targets',
    };
  }

  return {
    ...parsed,
    targetNodeIds: matchedNodeIds,
    targetSemanticKeys: matchedSemanticKeys,
    validation: hadUnknownTargets ? 'partial-targets' : 'accepted',
  };
}
