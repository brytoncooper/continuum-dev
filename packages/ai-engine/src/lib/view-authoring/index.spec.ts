import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from './index.js';

describe('view authoring router', () => {
  it('routes system prompts and user messages by format', () => {
    expect(
      buildViewAuthoringSystemPrompt({
        format: 'line-dsl',
        mode: 'create-view',
      })
    ).toContain('Return only Continuum View DSL.');

    expect(
      buildViewAuthoringSystemPrompt({
        format: 'yaml',
        mode: 'create-view',
      })
    ).toContain('```yaml');

    expect(
      buildViewAuthoringUserMessage({
        format: 'line-dsl',
        mode: 'evolve-view',
        instruction: 'Add an email field',
      })
    ).toContain('Return only Continuum View DSL.');

    expect(
      buildViewAuthoringUserMessage({
        format: 'yaml',
        mode: 'evolve-view',
        instruction: 'Add an email field',
      })
    ).toContain('Return exactly one ```yaml fenced block');
  });

  it('parses yaml and line dsl definitions through the public entry point', () => {
    expect(
      parseViewAuthoringToViewDefinition({
        format: 'yaml',
        text: `\`\`\`yaml
viewId: profile
version: "3"
nodes:
  - id: profile_group
    type: group
    children: []
\`\`\``,
      })
    ).toEqual({
      viewId: 'profile',
      version: '3',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          children: [],
        },
      ],
    });

    expect(
      parseViewAuthoringToViewDefinition({
        format: 'line-dsl',
        text: `view viewId="profile" version="3"
group id="profile_group"
  field id="email" key="email" label="Email" dataType="string"`,
      })
    ).toMatchObject({
      viewId: 'profile',
      version: '3',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'email',
              label: 'Email',
              dataType: 'string',
            },
          ],
        },
      ],
    });
  });
});
