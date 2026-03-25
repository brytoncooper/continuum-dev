import {
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from './prompt.js';

describe('view-patching prompts', () => {
  it('documents localized operations and supported operation kinds', () => {
    const prompt = buildPatchSystemPrompt();

    expect(prompt).toContain('live Continuum form');
    expect(prompt).toContain(
      'This is the localized structural edit lane, not the state-update lane and not full view authoring.'
    );
    expect(prompt).toContain('Response shape:');
    expect(prompt).toContain(
      'This lane only emits localized structural operations.'
    );
    expect(prompt).toContain(
      'Stay local. Do not use this lane for broad schema redesigns, value-only updates, or requests that clearly need a brand-new workflow.'
    );
    expect(prompt).toContain(
      'insert-node, move-node, wrap-nodes, replace-node, remove-node, append-content'
    );
    expect(prompt).toContain(
      'Preserve semantic continuity and detached key continuity.'
    );
  });

  it('keeps the output contract strict about the top-level JSON shape', () => {
    expect(VIEW_PATCH_OUTPUT_CONTRACT).toMatchObject({
      name: 'continuum_view_patch',
      strict: false,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['operations'],
      },
    });

    expect(
      VIEW_PATCH_OUTPUT_CONTRACT.schema.properties.operations.items.properties
    ).toEqual(
      expect.objectContaining({
        kind: { type: 'string' },
        parentId: { type: ['string', 'null'] },
        nodeId: { type: 'string' },
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
        },
        text: { type: 'string' },
      })
    );
  });

  it('builds the patch user message with serialized context and trimmed instructions', () => {
    const message = buildPatchUserMessage({
      viewId: 'invoice',
      version: '7',
      instruction: '  Add a sidebar note  ',
      nodeHints: [
        {
          path: 'details/body',
          id: 'body',
          parentPath: 'details',
          type: 'presentation',
        },
      ],
      compactTree: [
        {
          id: 'details',
          type: 'group',
          children: [
            {
              id: 'body',
              type: 'presentation',
              content: 'Body',
            },
          ],
        },
      ],
      detachedFields: [],
    });

    expect(message).toContain('live browser UI');
    expect(message).toContain('"viewId": "invoice"');
    expect(message).toContain('"version": "7"');
    expect(message).toContain(
      'Stay within localized structural edits. Do not return value-only state updates or a full next view here.'
    );
    expect(message).toContain('Node index:');
    expect(message).toContain('"path": "details/body"');
    expect(message).toContain('Compact full tree snapshot:');
    expect(message).toContain('Detached fields:\nnone');
    expect(message).toContain('Instruction:\nAdd a sidebar note');
  });

  it('serializes detached-field continuity hints when they are present', () => {
    const message = buildPatchUserMessage({
      viewId: 'profile',
      version: '2',
      instruction: 'Restore the email field',
      nodeHints: [],
      compactTree: [],
      detachedFields: [
        {
          detachedKey: 'detached:email',
          previousNodeType: 'field',
          reason: 'node-removed',
          viewVersion: '1',
          key: 'person.email',
          valuePreview: 'jordan@example.com',
        },
      ],
    });

    expect(message).toContain('"detachedKey": "detached:email"');
    expect(message).toContain('"key": "person.email"');
    expect(message).toContain('"valuePreview": "jordan@example.com"');
  });
});
