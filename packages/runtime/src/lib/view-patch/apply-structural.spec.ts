import type { ViewNode } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import { applyMoveNode, applyOperationToNodeList } from './apply-structural.js';

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
      id: 'sidebar',
      type: 'group',
      children: [],
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
  ];
}

function findNode(nodes: ViewNode[], nodeId: string): ViewNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    if ('children' in node && Array.isArray(node.children)) {
      const match = findNode(node.children, nodeId);
      if (match) {
        return match;
      }
    }

    if (node.type === 'collection') {
      const match = findNode([node.template], nodeId);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
}

describe('apply-structural', () => {
  it('inserts into a matching structural parent while reusing unrelated siblings', () => {
    const nodes = createNodes();
    const result = applyOperationToNodeList(nodes, {
      op: 'insert-node',
      parentId: 'details',
      position: {
        beforeId: 'body',
      },
      node: createPresentationNode('intro'),
    });

    expect(result.applied).toBe(true);
    expect(result.nodes[0]).toBe(nodes[0]);
    expect(findNode(result.nodes, 'details')).toEqual({
      id: 'details',
      type: 'group',
      children: [
        createPresentationNode('summary'),
        createPresentationNode('intro'),
        createPresentationNode('body'),
      ],
    });
  });

  it('replaces descendants inside collection templates', () => {
    const nodes = createNodes();
    const result = applyOperationToNodeList(nodes, {
      op: 'replace-node',
      nodeId: 'price',
      node: {
        id: 'price',
        type: 'field',
        dataType: 'number',
        label: 'Unit price',
      },
    });

    expect(result.applied).toBe(true);
    expect(findNode(result.nodes, 'price')).toMatchObject({
      id: 'price',
      type: 'field',
      dataType: 'number',
      label: 'Unit price',
    });
  });

  it('replaces a collection template root when targeted directly', () => {
    const nodes = createNodes();
    const nextTemplate: ViewNode = {
      id: 'line_item',
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
    };
    const result = applyOperationToNodeList(nodes, {
      op: 'replace-node',
      nodeId: 'line_item',
      node: nextTemplate,
    });

    expect(result.applied).toBe(true);
    expect(findNode(result.nodes, 'line_items')).toMatchObject({
      id: 'line_items',
      type: 'collection',
      template: nextTemplate,
    });
  });

  it('treats removing a collection template root as handled without changing the tree', () => {
    const nodes = createNodes();
    const result = applyOperationToNodeList(nodes, {
      op: 'remove-node',
      nodeId: 'line_item',
    });

    expect(result.applied).toBe(true);
    expect(result.nodes).toBe(nodes);
  });

  it('moves nodes between structural parents', () => {
    const nodes = createNodes();
    const result = applyMoveNode(nodes, {
      op: 'move-node',
      nodeId: 'body',
      parentId: 'sidebar',
      position: {
        index: 0,
      },
    });

    expect(result.applied).toBe(true);
    expect(findNode(result.nodes, 'details')).toEqual({
      id: 'details',
      type: 'group',
      children: [createPresentationNode('summary')],
    });
    expect(findNode(result.nodes, 'sidebar')).toEqual({
      id: 'sidebar',
      type: 'group',
      children: [createPresentationNode('body')],
    });
  });

  it('moves descendants out of collection templates', () => {
    const nodes = createNodes();
    const result = applyMoveNode(nodes, {
      op: 'move-node',
      nodeId: 'price',
      parentId: 'details',
      position: {
        afterId: 'summary',
      },
    });

    expect(result.applied).toBe(true);
    expect(findNode(result.nodes, 'details')).toEqual({
      id: 'details',
      type: 'group',
      children: [
        createPresentationNode('summary'),
        {
          id: 'price',
          type: 'field',
          dataType: 'number',
          label: 'Price',
        },
        createPresentationNode('body'),
      ],
    });
    expect(findNode(result.nodes, 'line_item')).toEqual({
      id: 'line_item',
      type: 'group',
      children: [
        {
          id: 'name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
        },
      ],
    });
  });

  it('refuses to move a collection template root out of its collection', () => {
    const nodes = createNodes();
    const result = applyMoveNode(nodes, {
      op: 'move-node',
      nodeId: 'line_item',
      parentId: 'details',
    });

    expect(result.applied).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('restores the original tree when a move cannot be reinserted', () => {
    const nodes = createNodes();
    const result = applyMoveNode(nodes, {
      op: 'move-node',
      nodeId: 'body',
      parentId: 'title',
    });

    expect(result.applied).toBe(false);
    expect(result.nodes).toBe(nodes);
  });
});
