import {
  buildPatchSystemPrompt,
  buildPatchUserMessage,
  VIEW_PATCH_OUTPUT_CONTRACT,
} from './prompt.js';

describe('view-patching prompts', () => {
  it('documents the patch/full modes and supported operations', () => {
    const prompt = buildPatchSystemPrompt();

    expect(prompt).toContain('live Continuum form');
    expect(prompt).toContain('mode="patch"');
    expect(prompt).toContain('mode="full"');
    expect(prompt).toContain('fullStrategy as either "evolve" or "replace"');
    expect(prompt).toContain(
      'insert-node, move-node, wrap-nodes, replace-node, remove-node, append-content'
    );
    expect(prompt).toContain('Preserve semantic continuity and detached key continuity.');
  });

  it('keeps the output contract strict about the top-level JSON shape', () => {
    expect(VIEW_PATCH_OUTPUT_CONTRACT).toMatchObject({
      name: 'continuum_view_patch',
      strict: false,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['mode', 'operations'],
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
