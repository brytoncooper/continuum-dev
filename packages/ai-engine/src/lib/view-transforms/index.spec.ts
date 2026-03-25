import {
  buildSurgicalTransformSystemPrompt,
  buildSurgicalTransformUserMessage,
  buildTransformSystemPrompt,
  buildTransformUserMessage,
} from './index.js';

describe('view transforms prompts', () => {
  it('describes the live browser form context in transform prompts', () => {
    const systemPrompt = buildTransformSystemPrompt();
    const userPrompt = buildTransformUserMessage({
      instruction: 'Merge first and last name into full name',
      currentView: {
        viewId: 'profile',
        version: '1',
        nodes: [],
      },
      nextView: {
        viewId: 'profile',
        version: '2',
        nodes: [],
      },
      currentData: {},
      selectedTargets: ['person.fullName'],
    });

    expect(systemPrompt).toContain('live Continuum form in a web browser');
    expect(systemPrompt).toContain(
      'This is the continuity-aware structural refactor lane, not routine state updates, not localized patching, and not full view authoring.'
    );
    expect(userPrompt).toContain('Continuum context:');
    expect(userPrompt).toContain('preserve meaningful user data');
    expect(userPrompt).toContain('Selected targets:');
    expect(userPrompt).not.toContain('Planner-selected targets:');
  });

  it('describes the live browser form context in surgical transform prompts', () => {
    const systemPrompt = buildSurgicalTransformSystemPrompt();
    const userPrompt = buildSurgicalTransformUserMessage({
      instruction: 'Split full name into first and last name',
      currentView: {
        viewId: 'profile',
        version: '1',
        nodes: [],
      },
      currentData: {},
      selectedTargets: ['person.fullName'],
    });

    expect(systemPrompt).toContain('change to the current UI');
    expect(systemPrompt).toContain('evolve the existing form carefully');
    expect(systemPrompt).toContain(
      'This is the continuity-aware structural refactor lane, not routine state updates and not full view authoring.'
    );
    expect(userPrompt).toContain('Continuum context:');
    expect(userPrompt).toContain('patch operations directly reshape');
    expect(userPrompt).toContain('Selected targets:');
    expect(userPrompt).not.toContain('Planner-selected targets:');
  });
});
