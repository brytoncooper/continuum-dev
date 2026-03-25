import {
  buildViewYamlSystemPrompt,
  buildViewYamlUserMessage,
  parseViewYamlToViewDefinition,
} from '../../../index.js';
import type { ViewDefinition } from '@continuum-dev/core';

describe('view-authoring yaml', () => {
  it('parses fenced yaml into a view definition', () => {
    const parsed = parseViewYamlToViewDefinition({
      text: `\`\`\`yaml
viewId: profile
version: "2"
nodes:
  - id: profile_group
    type: group
    children:
      - id: email
        type: field
        dataType: string
\`\`\``,
    });

    expect(parsed).toMatchObject({
      viewId: 'profile',
      version: '2',
      nodes: [{ id: 'profile_group', type: 'group' }],
    });
  });

  it('extracts the yaml block from a larger markdown reply and supports a nested view root', () => {
    const parsed = parseViewYamlToViewDefinition({
      text: `Here is the updated form.

\`\`\`json
{"ignore":true}
\`\`\`

\`\`\`yaml
view:
  viewId: profile
  version: "3"
  nodes:
    - id: profile_group
      type: group
      children: []
\`\`\``,
    });

    expect(parsed).toEqual({
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
  });

  it('uses fallback metadata when yaml omits view id and version', () => {
    const fallbackView: ViewDefinition = {
      viewId: 'profile',
      version: '7',
      nodes: [],
    };
    const parsed = parseViewYamlToViewDefinition({
      text: `nodes:
  - id: profile_group
    type: group
    children: []`,
      fallbackView,
    });

    expect(parsed).toMatchObject({
      viewId: 'profile',
      version: '8',
    });
  });

  it('returns null when yaml does not provide nodes', () => {
    expect(
      parseViewYamlToViewDefinition({
        text: `\`\`\`yaml
viewId: profile
version: "2"
\`\`\``,
      })
    ).toBeNull();
  });

  it('builds yaml prompts and user messages', () => {
    const systemPrompt = buildViewYamlSystemPrompt({ mode: 'create-view' });
    const userMessage = buildViewYamlUserMessage({
      mode: 'correction-loop',
      instruction: 'Fix it',
      validationErrors: ['bad structure'],
      runtimeErrors: ['boom'],
    });

    expect(systemPrompt).toContain('Continuum product context:');
    expect(systemPrompt).toContain(
      'This is full view authoring. Do not return state, patch, or transform JSON.'
    );
    expect(systemPrompt).toContain('```yaml');
    expect(userMessage).toContain('Continuum context:');
    expect(userMessage).toContain(
      'This is the full-view authoring lane. Do not answer with state updates, patch operations, or transform plans.'
    );
    expect(userMessage).toContain('Return exactly one ```yaml fenced block');
  });
});
