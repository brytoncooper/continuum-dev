import {
  buildViewAuthoringSystemPrompt,
  buildViewAuthoringUserMessage,
  parseViewAuthoringToViewDefinition,
} from './index.js';

const sharedLayoutAnchor = 'Use row for 2-3 short related fields';

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

    const viewJsonPrompt = buildViewAuthoringSystemPrompt({
      format: 'view-json',
      mode: 'create-view',
    });
    expect(viewJsonPrompt).toContain('You generate Continuum ViewDefinition JSON');
    expect(viewJsonPrompt).toContain('<continuum_view_authoring>');

    expect(
      buildViewAuthoringUserMessage({
        format: 'view-json',
        mode: 'evolve-view',
        instruction: 'Add an email field',
      })
    ).toContain('Return only JSON that matches the output contract');
  });

  it('keeps shared layout guidance in line-dsl, yaml, and view-json system prompts', () => {
    expect(
      buildViewAuthoringSystemPrompt({
        format: 'line-dsl',
        mode: 'create-view',
      })
    ).toContain(sharedLayoutAnchor);

    expect(
      buildViewAuthoringSystemPrompt({
        format: 'yaml',
        mode: 'create-view',
      })
    ).toContain(sharedLayoutAnchor);

    expect(
      buildViewAuthoringSystemPrompt({
        format: 'view-json',
        mode: 'create-view',
      })
    ).toContain(sharedLayoutAnchor);
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

    expect(
      parseViewAuthoringToViewDefinition({
        format: 'view-json',
        text: '',
        json: {
          viewId: 'j',
          version: '1',
          nodes: [{ id: 'a', type: 'group', children: [] }],
        },
      })
    ).toMatchObject({
      viewId: 'j',
      nodes: [{ id: 'a', type: 'group' }],
    });

    expect(
      parseViewAuthoringToViewDefinition({
        format: 'view-json',
        text: JSON.stringify({
          viewId: 'from_text',
          version: '2',
          nodes: [{ id: 'root', type: 'group', children: [] }],
        }),
      })
    ).toMatchObject({ viewId: 'from_text' });
  });
});
