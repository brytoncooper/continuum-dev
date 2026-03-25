import { buildStateSystemPrompt, buildStateUserMessage } from './state-prompts.js';

describe('state prompts', () => {
  it('keeps state mode scoped to value updates', () => {
    const prompt = buildStateSystemPrompt();

    expect(prompt).toContain('Stay inside the state-update contract.');
    expect(prompt).toContain(
      'When multiple targets could match, prefer fewer updates over speculative broad edits unless the instruction clearly asks for a wider fill.'
    );
    expect(prompt).toContain(
      'When the user gives explicit values, use those values for the matching targets instead of inventing examples.'
    );
  });

  it('builds the user message with a value-only execution boundary', () => {
    const message = buildStateUserMessage({
      instruction: '  Fill in the email address  ',
      currentData: { email: { value: '' } },
      stateTargets: [{ nodeId: 'email', key: 'email' } as never],
      selectedTargets: [],
    });

    expect(message).toContain('Return the next Continuum state updates as JSON only.');
    expect(message).toContain(
      '- Stay within value updates only. Do not return structural or full-view output.'
    );
    expect(message).toContain(
      'none selected; infer the smallest safe matching targets from the available state targets below.'
    );
    expect(message).toContain('Instruction:\nFill in the email address');
  });
});
