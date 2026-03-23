import {
  isViewPatchPlan,
  normalizeViewPatchOperation,
  normalizeViewPatchPlan,
} from './normalize.js';

describe('view-patching normalization', () => {
  it('recognizes only patch/full objects with an operations array as patch plans', () => {
    expect(isViewPatchPlan({ mode: 'patch', operations: [] })).toBe(true);
    expect(isViewPatchPlan({ mode: 'full', operations: [] })).toBe(true);
    expect(isViewPatchPlan({ mode: 'patch' })).toBe(false);
    expect(isViewPatchPlan({ mode: 'state', operations: [] })).toBe(false);
    expect(isViewPatchPlan(null)).toBe(false);
  });

  it('normalizes valid insert-node payloads and preserves explicit top-level targets', () => {
    expect(
      normalizeViewPatchOperation({
        kind: 'insert-node',
        parentId: null,
        position: {
          beforeId: 'details',
        },
        node: {
          id: 'save',
          type: 'action',
        },
      })
    ).toEqual({
      kind: 'insert-node',
      parentId: null,
      position: {
        beforeId: 'details',
      },
      node: {
        id: 'save',
        type: 'action',
        intentId: 'save.submit',
        label: 'Submit',
      },
    });
  });

  it('keeps only meaningful position hints for move operations', () => {
    expect(
      normalizeViewPatchOperation({
        kind: 'move-node',
        nodeId: 'body',
        position: {
          beforeId: '   ',
          afterId: 'summary',
          index: 1.5,
        },
      })
    ).toEqual({
      kind: 'move-node',
      nodeId: 'body',
      position: {
        afterId: 'summary',
      },
    });
  });

  it('accepts targetId as an alias for nodeId on operations that target an existing node', () => {
    expect(
      normalizeViewPatchOperation({
        kind: 'replace-node',
        targetId: 'welcome_text',
        node: {
          id: 'welcome_text',
          type: 'presentation',
          contentType: 'text',
          content: 'Hi',
        },
      })
    ).toMatchObject({
      kind: 'replace-node',
      nodeId: 'welcome_text',
    });

    expect(
      normalizeViewPatchOperation({
        kind: 'remove-node',
        targetId: 'old_node',
      })
    ).toEqual({
      kind: 'remove-node',
      nodeId: 'old_node',
    });

    expect(
      normalizeViewPatchOperation({
        kind: 'move-node',
        targetId: 'body',
        position: { index: 0 },
      })
    ).toMatchObject({
      kind: 'move-node',
      nodeId: 'body',
      position: { index: 0 },
    });
  });

  it('rejects invalid wrap operations before they reach the runtime patcher', () => {
    expect(
      normalizeViewPatchOperation({
        kind: 'wrap-nodes',
        parentId: null,
        nodeIds: ['details', 'sidebar'],
        wrapper: {
          id: 'bad_wrapper',
          type: 'presentation',
          contentType: 'text',
          content: 'nope',
        },
      })
    ).toBeNull();

    expect(
      normalizeViewPatchOperation({
        kind: 'wrap-nodes',
        nodeIds: ['details', '   '],
        wrapper: {
          id: 'content_row',
          type: 'row',
          children: [],
        },
      })
    ).toBeNull();
  });

  it('rejects blank identifiers and empty text for direct operations', () => {
    expect(
      normalizeViewPatchOperation({
        kind: 'move-node',
        nodeId: '   ',
      })
    ).toBeNull();
    expect(
      normalizeViewPatchOperation({
        kind: 'replace-node',
        nodeId: '',
        node: {
          id: 'title',
          type: 'presentation',
          contentType: 'text',
          content: 'Invoice',
        },
      })
    ).toBeNull();
    expect(
      normalizeViewPatchOperation({
        kind: 'remove-node',
        nodeId: '',
      })
    ).toBeNull();
    expect(
      normalizeViewPatchOperation({
        kind: 'append-content',
        nodeId: 'body',
        text: '',
      })
    ).toBeNull();
    expect(
      normalizeViewPatchOperation({
        kind: 'append-content',
        nodeId: '   ',
        text: 'extra',
      })
    ).toBeNull();
  });

  it('rejects whole patch plans when any operation is invalid', () => {
    expect(
      normalizeViewPatchPlan({
        mode: 'patch',
        operations: [
          {
            kind: 'remove-node',
            nodeId: 'first_name',
          },
          {
            kind: 'replace-node',
            nodeId: '',
            node: {
              id: 'full_name',
              type: 'field',
              key: 'full_name',
              label: 'Full name',
              dataType: 'string',
            },
          },
        ],
      })
    ).toEqual({
      plan: null,
      reason: 'Patch operation 2 was invalid or unsupported.',
    });
  });

  it('rejects patch plans that normalize down to zero operations', () => {
    expect(
      normalizeViewPatchPlan({
        mode: 'patch',
        operations: [],
      })
    ).toEqual({
      plan: null,
      reason: 'Patch plan did not include any usable operations.',
    });
  });

  it('normalizes entire patch plans before they reach execution', () => {
    expect(
      normalizeViewPatchPlan({
        mode: 'patch',
        reason: 'Merge name fields',
        operations: [
          {
            kind: 'insert-node',
            parentId: 'profile',
            position: {
              afterId: 'first_name',
              beforeId: '   ',
            },
            node: {
              id: 'full_name',
              type: 'field',
              key: 'full_name',
              label: 'Full name',
              dataType: 'string',
            },
          },
        ],
      })
    ).toEqual({
      plan: {
        mode: 'patch',
        reason: 'Merge name fields',
        operations: [
          {
            kind: 'insert-node',
            parentId: 'profile',
            position: {
              afterId: 'first_name',
            },
            node: {
              id: 'full_name',
              type: 'field',
              key: 'full_name',
              label: 'Full name',
              dataType: 'string',
            },
          },
        ],
      },
    });
  });
});
