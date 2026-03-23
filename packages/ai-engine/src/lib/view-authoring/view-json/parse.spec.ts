import { describe, expect, it } from 'vitest';
import { parseViewJsonToViewDefinition } from './parse.js';

const minimalView = {
  viewId: 'v1',
  version: '1',
  nodes: [
    {
      id: 'root',
      type: 'group',
      children: [],
    },
  ],
};

describe('parseViewJsonToViewDefinition', () => {
  it('prefers json when it is a valid ViewDefinition', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: 'not valid dsl',
        json: minimalView,
      })
    ).toMatchObject({ viewId: 'v1', nodes: [{ id: 'root' }] });
  });

  it('parses JSON from text when json is absent', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: JSON.stringify(minimalView),
      })
    ).toMatchObject({ viewId: 'v1' });
  });

  it('returns null for invalid payloads', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: 'not json',
        json: null,
      })
    ).toBeNull();

    expect(
      parseViewJsonToViewDefinition({
        text: '{"foo":1}',
      })
    ).toBeNull();
  });

  it('extracts JSON from fenced or noisy text', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: `\`\`\`json\n${JSON.stringify(minimalView)}\n\`\`\``,
      })
    ).toMatchObject({ viewId: 'v1' });
  });

  it('falls back to text when json is present but not a ViewDefinition', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: JSON.stringify(minimalView),
        json: { foo: 1 },
      })
    ).toMatchObject({ viewId: 'v1' });
  });

  it('prefers valid json over text when both parse', () => {
    const fromText = { ...minimalView, viewId: 'from_text' };
    const fromJson = { ...minimalView, viewId: 'from_json' };
    expect(
      parseViewJsonToViewDefinition({
        text: JSON.stringify(fromText),
        json: fromJson,
      })
    ).toMatchObject({ viewId: 'from_json' });
  });

  it('returns null when json is invalid and text cannot yield a view', () => {
    expect(
      parseViewJsonToViewDefinition({
        text: '',
        json: { invalid: true },
      })
    ).toBeNull();

    expect(
      parseViewJsonToViewDefinition({
        text: 'not json',
        json: null,
      })
    ).toBeNull();
  });
});
