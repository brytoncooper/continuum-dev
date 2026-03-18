import type { ViewNode } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import { wrapNodesInList } from './apply-wrap.js';

function createPresentationNode(id: string): ViewNode {
  return {
    id,
    type: 'presentation',
    contentType: 'text',
    content: id,
  };
}

function createNodes(): ViewNode[] {
  return [
    createPresentationNode('title'),
    {
      id: 'details',
      type: 'group',
      children: [
        createPresentationNode('summary'),
        createPresentationNode('body'),
      ],
    },
    {
      id: 'line_items',
      type: 'collection',
      template: {
        id: 'line_item',
        type: 'group',
        children: [
          {
            id: 'name',
            type: 'field',
            dataType: 'string',
            label: 'Name',
          },
          {
            id: 'price',
            type: 'field',
            dataType: 'number',
            label: 'Price',
          },
        ],
      },
    },
    createPresentationNode('footer'),
  ];
}

describe('wrapNodesInList', () => {
  it('wraps top-level siblings at the first selected index', () => {
    const nodes = createNodes();
    const result = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: null,
        nodeIds: ['details', 'line_items'],
        wrapper: {
          id: 'content_row',
          type: 'row',
          children: [],
        },
      },
      null
    );

    expect(result.applied).toBe(true);
    expect(result.nodes.map((node) => node.id)).toEqual([
      'title',
      'content_row',
      'footer',
    ]);
    expect(result.nodes[1]).toMatchObject({
      id: 'content_row',
      type: 'row',
    });
  });

  it('wraps nested structural siblings when the parent is deeper in the tree', () => {
    const nodes = createNodes();
    const result = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: 'details',
        nodeIds: ['summary', 'body'],
        wrapper: {
          id: 'details_row',
          type: 'row',
          children: [],
        },
      },
      null
    );

    expect(result.applied).toBe(true);
    expect(result.nodes[1]).toMatchObject({
      id: 'details',
      type: 'group',
      children: [
        {
          id: 'details_row',
          type: 'row',
          children: [
            createPresentationNode('summary'),
            createPresentationNode('body'),
          ],
        },
      ],
    });
  });

  it('wraps collection template siblings through template traversal', () => {
    const nodes = createNodes();
    const result = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: 'line_item',
        nodeIds: ['name', 'price'],
        wrapper: {
          id: 'line_item_row',
          type: 'row',
          children: [],
        },
      },
      null
    );

    expect(result.applied).toBe(true);
    expect(result.nodes[2]).toMatchObject({
      id: 'line_items',
      type: 'collection',
      template: {
        id: 'line_item',
        type: 'group',
        children: [
          {
            id: 'line_item_row',
            type: 'row',
            children: [
              {
                id: 'name',
                type: 'field',
                dataType: 'string',
                label: 'Name',
              },
              {
                id: 'price',
                type: 'field',
                dataType: 'number',
                label: 'Price',
              },
            ],
          },
        ],
      },
    });
  });

  it('returns a no-op when the wrapper node is not structural', () => {
    const nodes = createNodes();
    const result = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: null,
        nodeIds: ['details', 'line_items'],
        wrapper: createPresentationNode('invalid_wrapper'),
      },
      null
    );

    expect(result.applied).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('returns a no-op when targeted node ids are missing or empty', () => {
    const nodes = createNodes();

    const missingNodeResult = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: null,
        nodeIds: ['details', 'missing'],
        wrapper: {
          id: 'content_row',
          type: 'row',
          children: [],
        },
      },
      null
    );

    const emptySelectionResult = wrapNodesInList(
      nodes,
      {
        op: 'wrap-nodes',
        parentId: null,
        nodeIds: [],
        wrapper: {
          id: 'content_row',
          type: 'row',
          children: [],
        },
      },
      null
    );

    expect(missingNodeResult.applied).toBe(false);
    expect(missingNodeResult.nodes).toBe(nodes);
    expect(emptySelectionResult.applied).toBe(false);
    expect(emptySelectionResult.nodes).toBe(nodes);
  });
});
