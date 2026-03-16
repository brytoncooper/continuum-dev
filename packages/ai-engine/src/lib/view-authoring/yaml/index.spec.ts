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

  it('builds yaml prompts and user messages', () => {
    expect(
      buildViewYamlSystemPrompt({ mode: 'create-view' })
    ).toContain('```yaml');
    expect(
      buildViewYamlUserMessage({
        mode: 'correction-loop',
        instruction: 'Fix it',
        validationErrors: ['bad structure'],
        runtimeErrors: ['boom'],
      })
    ).toContain('Return exactly one ```yaml fenced block');
  });
});
