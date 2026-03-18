import { isViewPatchPlan, normalizeViewPatchOperation } from './normalize.js';

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
});
