import { buildViewJsonSystemPrompt, buildViewJsonUserMessage } from './prompt.js';

describe('view-json system prompt', () => {
  it('includes shared Continuum authoring anchors aligned with line-dsl and yaml', () => {
    const prompt = buildViewJsonSystemPrompt({
      mode: 'evolve-view',
      addons: ['strict-continuity', 'attachments'],
    });

    expect(prompt).toContain('<continuum_view_authoring>');
    expect(prompt).toContain(
      'This is full view authoring. Do not return state updates, patch operations, or transform plans.'
    );
    expect(prompt).toContain(
      '- The JSON object you return becomes the UI a user sees in a live browser session.'
    );
    expect(prompt).toContain(
      'Use semanticKey on every stateful node (field, textarea, date, select, radio-group, slider, toggle, collection).'
    );
    expect(prompt).toContain('Use row for 2-3 short related fields');
    expect(prompt).toContain(
      'Detached fields are previously removed fields whose user data can still be restored by the runtime.'
    );
    expect(prompt).toContain(
      'Preserve semantic keys and node types when meaning is unchanged.'
    );
    expect(prompt).toContain(
      'When useful, include sensible defaultValue or defaultValues inferred from provided context.'
    );
    expect(prompt).toContain('"viewId": "profile_form"');
    expect(prompt).toContain('You generate Continuum ViewDefinition JSON');
  });

  it('includes create-view mode guidance in the authoring extension', () => {
    const prompt = buildViewJsonSystemPrompt({ mode: 'create-view' });
    expect(prompt).toContain('Create a brand-new view from the user request.');
  });

  it('includes correction-loop mode guidance in the authoring extension', () => {
    const prompt = buildViewJsonSystemPrompt({ mode: 'correction-loop' });
    expect(prompt).toContain(
      'Return a corrected next view that resolves the provided errors while preserving unchanged semantics and current workflow when possible.'
    );
  });

  it('does not add strict-continuity addon lines when addons are omitted', () => {
    const prompt = buildViewJsonSystemPrompt({ mode: 'evolve-view' });
    expect(prompt).not.toContain(
      'Preserve semantic keys and node types when meaning is unchanged.'
    );
  });
});

describe('view-json user message', () => {
  it('includes correction-loop sections and JSON output footer like other formats', () => {
    const message = buildViewJsonUserMessage({
      mode: 'correction-loop',
      instruction: '  Fix the layout  ',
      currentView: { viewId: 'profile' },
      detachedFields: [],
      validationErrors: ['missing primary action'],
      runtimeErrors: [],
    });

    expect(message).toContain('Continuum context:');
    expect(message).toContain(
      'This is the full-view authoring lane. Do not answer with state updates, patch operations, or transform plans.'
    );
    expect(message).toContain('Current view:\n{\n  "viewId": "profile"\n}');
    expect(message).toContain('Detached fields:\nnone');
    expect(message).toContain('Validation errors:\nmissing primary action');
    expect(message).toContain('Runtime errors:\nnone');
    expect(message).toContain('Instruction:\nFix the layout');
    expect(message).toContain(
      'Return only JSON that matches the output contract (viewId, version, nodes). No markdown fences, no commentary outside the JSON object.'
    );
  });

  it('does not include correction sections outside correction-loop mode', () => {
    const message = buildViewJsonUserMessage({
      mode: 'evolve-view',
      instruction: 'Add a notes field',
      validationErrors: ['should not appear'],
      runtimeErrors: ['should not appear'],
    });

    expect(message).not.toContain('Validation errors:');
    expect(message).not.toContain('Runtime errors:');
    expect(message).toContain('Instruction:\nAdd a notes field');
  });
});
