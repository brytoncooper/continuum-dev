import { describe, expect, it } from 'vitest';
import {
  collectContinuumViewPatchAffectedNodeIds,
  type ContinuumViewPatch,
} from './index.js';

function createPresentationNode(id: string) {
  return {
    id,
    type: 'presentation' as const,
    contentType: 'text' as const,
    content: id,
  };
}

describe('collectContinuumViewPatchAffectedNodeIds', () => {
  it('collects recursive ids across all operation types without duplicates', () => {
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'insert-node',
          parentId: 'details',
          node: {
            id: 'intro_group',
            type: 'group',
            children: [createPresentationNode('intro_copy')],
          },
        },
        {
          op: 'move-node',
          nodeId: 'summary',
          parentId: 'sidebar',
        },
        {
          op: 'wrap-nodes',
          parentId: 'details',
          nodeIds: ['summary', 'body'],
          wrapper: {
            id: 'content_row',
            type: 'row',
            children: [createPresentationNode('row_hint')],
          },
        },
        {
          op: 'replace-node',
          nodeId: 'body',
          node: {
            id: 'body',
            type: 'group',
            children: [createPresentationNode('body_copy')],
          },
        },
        {
          op: 'remove-node',
          nodeId: 'summary',
        },
      ],
    };

    expect(new Set(collectContinuumViewPatchAffectedNodeIds(patch))).toEqual(
      new Set([
        'details',
        'intro_group',
        'intro_copy',
        'summary',
        'sidebar',
        'body',
        'content_row',
        'row_hint',
        'body_copy',
      ])
    );
  });

  it('skips nullish parent ids for top-level operations', () => {
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'insert-node',
          parentId: null,
          node: createPresentationNode('top_level_intro'),
        },
        {
          op: 'move-node',
          nodeId: 'summary',
          parentId: null,
        },
        {
          op: 'wrap-nodes',
          parentId: null,
          nodeIds: ['summary', 'body'],
          wrapper: {
            id: 'top_level_row',
            type: 'row',
            children: [],
          },
        },
      ],
    };

    expect(new Set(collectContinuumViewPatchAffectedNodeIds(patch))).toEqual(
      new Set(['top_level_intro', 'summary', 'body', 'top_level_row'])
    );
  });
});
