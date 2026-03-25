import {
  getChildNodes,
  type ViewDefinition,
  type ViewNode,
} from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import { applyContinuumViewPatch, type ContinuumViewPatch } from './index.js';

function createPresentationNode(id: string, content = id): ViewNode {
  return {
    id,
    type: 'presentation',
    contentType: 'text',
    content,
  };
}

function createInvoiceView(): ViewDefinition {
  return {
    viewId: 'invoice',
    version: 'v1',
    nodes: [
      createPresentationNode('title', 'Invoice'),
      {
        id: 'details',
        type: 'group',
        semanticKey: 'invoice.details',
        label: 'Details',
        children: [
          {
            ...createPresentationNode('summary', 'Summary'),
            semanticKey: 'invoice.summary',
          },
          {
            id: 'body',
            type: 'presentation',
            contentType: 'markdown',
            content: 'Body',
          },
        ],
      },
      {
        id: 'sidebar',
        type: 'group',
        label: 'Sidebar',
        children: [],
      },
      {
        id: 'line_items',
        type: 'collection',
        label: 'Line items',
        defaultValues: [{}],
        template: {
          id: 'line_item',
          type: 'group',
          label: 'Line item',
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
              semanticKey: 'invoice.lineItem.price',
              label: 'Price',
            },
          ],
        },
      },
      createPresentationNode('footer', 'Thanks'),
    ],
  };
}

function findNode(nodes: ViewNode[], nodeId: string): ViewNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    const childMatch = findNode(getChildNodes(node), nodeId);
    if (childMatch) {
      return childMatch;
    }
  }

  return undefined;
}

function requireNode(view: ViewDefinition, nodeId: string): ViewNode {
  const node = findNode(view.nodes, nodeId);
  if (!node) {
    throw new Error(`Expected node ${nodeId} to exist`);
  }

  return node;
}

function requireContainerChildIds(
  view: ViewDefinition,
  nodeId: string
): string[] {
  const node = requireNode(view, nodeId);
  if (node.type !== 'group' && node.type !== 'row' && node.type !== 'grid') {
    throw new Error(`Expected ${nodeId} to be a structural container`);
  }

  return node.children.map((child) => child.id);
}

describe('applyContinuumViewPatch', () => {
  it('applies top-level inserts in order and updates patch metadata', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      viewId: 'invoice-v2',
      version: 'v2',
      operations: [
        {
          op: 'insert-node',
          position: {
            beforeId: 'details',
          },
          node: createPresentationNode('intro', 'Intro'),
        },
        {
          op: 'insert-node',
          position: {
            afterId: 'sidebar',
          },
          node: createPresentationNode('appendix', 'Appendix'),
        },
        {
          op: 'insert-node',
          position: {
            index: 999,
          },
          node: createPresentationNode('legal', 'Legal'),
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(nextView.viewId).toBe('invoice-v2');
    expect(nextView.version).toBe('v2');
    expect(nextView.nodes.map((node) => node.id)).toEqual([
      'title',
      'intro',
      'details',
      'sidebar',
      'appendix',
      'line_items',
      'footer',
      'legal',
    ]);
  });

  it('inserts nodes into nested collection template containers', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'insert-node',
          parentId: 'line_item',
          position: {
            afterId: 'name',
          },
          node: createPresentationNode('note', 'Line item note'),
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'line_item')).toEqual([
      'name',
      'note',
      'price',
    ]);
  });

  it('replaces collection template descendants without recreating unrelated nodes', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'replace-node',
          nodeId: 'price',
          node: {
            id: 'price',
            type: 'field',
            dataType: 'number',
            label: 'Unit price',
            description: 'Before tax',
          },
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);
    const priceNode = requireNode(nextView, 'price');

    expect(nextView.nodes[0]).toBe(currentView.nodes[0]);
    expect(priceNode).toMatchObject({
      id: 'price',
      type: 'field',
      dataType: 'number',
      label: 'Unit price',
      description: 'Before tax',
    });
  });

  it('resolves semantic selectors for targeted replacements and parent-based inserts', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'replace-node',
          semanticKey: 'invoice.lineItem.price',
          node: {
            id: 'price',
            type: 'field',
            dataType: 'number',
            semanticKey: 'invoice.lineItem.price',
            label: 'Unit price',
          },
        },
        {
          op: 'insert-node',
          parentSemanticKey: 'invoice.details',
          position: {
            afterSemanticKey: 'invoice.summary',
          },
          node: createPresentationNode('meta', 'Metadata'),
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'details')).toEqual([
      'summary',
      'meta',
      'body',
    ]);
    expect(requireNode(nextView, 'price')).toMatchObject({
      label: 'Unit price',
      semanticKey: 'invoice.lineItem.price',
    });
  });

  it('removes descendants from collection templates', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'remove-node',
          nodeId: 'price',
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'line_item')).toEqual(['name']);
    expect(findNode(nextView.nodes, 'price')).toBeUndefined();
  });

  it('moves nodes between structural parents', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'move-node',
          nodeId: 'body',
          parentId: 'sidebar',
          position: {
            index: 0,
          },
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'details')).toEqual(['summary']);
    expect(requireContainerChildIds(nextView, 'sidebar')).toEqual(['body']);
  });

  it('moves nested nodes to the top level when parentId is null', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'move-node',
          nodeId: 'summary',
          parentId: null,
          position: {
            afterId: 'footer',
          },
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'details')).toEqual(['body']);
    expect(nextView.nodes.map((node) => node.id)).toEqual([
      'title',
      'details',
      'sidebar',
      'line_items',
      'footer',
      'summary',
    ]);
  });

  it('treats invalid move destinations as a no-op', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'move-node',
          nodeId: 'body',
          parentId: 'title',
        },
      ],
    };

    expect(applyContinuumViewPatch(currentView, patch)).toBe(currentView);
  });

  it('does not move a collection template root out of its collection', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'move-node',
          nodeId: 'line_item',
          parentId: 'details',
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(nextView).toBe(currentView);
  });

  it('wraps top-level siblings at the first selected index', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'wrap-nodes',
          parentId: null,
          nodeIds: ['details', 'sidebar'],
          wrapper: {
            id: 'content_row',
            type: 'row',
            children: [],
          },
        },
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);
    const contentRow = requireNode(nextView, 'content_row');

    expect(nextView.nodes.map((node) => node.id)).toEqual([
      'title',
      'content_row',
      'line_items',
      'footer',
    ]);
    expect(contentRow.type).toBe('row');
    expect(requireContainerChildIds(nextView, 'content_row')).toEqual([
      'details',
      'sidebar',
    ]);
  });

  it('wraps collection template siblings in a new row', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
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
      ],
    };

    const nextView = applyContinuumViewPatch(currentView, patch);

    expect(requireContainerChildIds(nextView, 'line_item')).toEqual([
      'line_item_row',
    ]);
    expect(requireContainerChildIds(nextView, 'line_item_row')).toEqual([
      'name',
      'price',
    ]);
  });

  it('treats invalid wrap operations as a no-op', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'wrap-nodes',
          parentId: null,
          nodeIds: ['details', 'sidebar'],
          wrapper: {
            id: 'invalid_wrapper',
            type: 'presentation',
            contentType: 'text',
            content: 'Invalid',
          },
        },
      ],
    };

    expect(applyContinuumViewPatch(currentView, patch)).toBe(currentView);
  });

  it('ignores remove-node operations that target a collection template root', () => {
    const currentView = createInvoiceView();
    const patch: ContinuumViewPatch = {
      operations: [
        {
          op: 'remove-node',
          nodeId: 'line_item',
        },
      ],
    };

    expect(applyContinuumViewPatch(currentView, patch)).toBe(currentView);
  });
});
