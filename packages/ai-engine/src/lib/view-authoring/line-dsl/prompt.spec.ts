import {
  buildViewLineDslSystemPrompt,
  buildViewLineDslUserMessage,
} from './prompt.js';

describe('view line dsl prompts', () => {
  it('includes mode-specific guidance and deduplicates addon instructions', () => {
    const prompt = buildViewLineDslSystemPrompt({
      mode: 'correction-loop',
      addons: ['strict-continuity', 'attachments', 'attachments'],
    });

    expect(prompt).toContain('Continuum product context:');
    expect(prompt).toContain(
      'Return a corrected next view that resolves the provided errors while preserving unchanged semantics and current workflow when possible.'
    );
    expect(
      prompt.match(
        /Preserve semantic keys and node types when meaning is unchanged\./g
      )
    ).toHaveLength(1);
    expect(
      prompt.match(
        /When useful, include sensible defaultValue or defaultValues inferred from provided context\./g
      )
    ).toHaveLength(1);
  });

  it('includes current state and correction errors in correction-loop user messages', () => {
    const message = buildViewLineDslUserMessage({
      mode: 'correction-loop',
      instruction: '  Fix the layout  ',
      currentView: { viewId: 'profile' },
      detachedFields: [],
      validationErrors: ['missing primary action'],
      runtimeErrors: [],
    });

    expect(message).toContain('Continuum context:');
    expect(message).toContain('Current view:\n{\n  "viewId": "profile"\n}');
    expect(message).toContain('Detached fields:\nnone');
    expect(message).toContain('Validation errors:\nmissing primary action');
    expect(message).toContain('Runtime errors:\nnone');
    expect(message).toContain('Instruction:\nFix the layout');
  });

  it('does not include correction sections outside correction-loop mode', () => {
    const message = buildViewLineDslUserMessage({
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
