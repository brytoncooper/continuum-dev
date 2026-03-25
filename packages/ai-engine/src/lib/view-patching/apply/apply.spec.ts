import type { ViewDefinition, ViewNode } from '@continuum-dev/core';
import { applyPatchPlanToView } from './apply.js';

function createPresentationNode(id: string, content = id): ViewNode {
  return {
    id,
    type: 'presentation',
    contentType: 'text',
    content,
  };
}

function createInvoiceView(version = '1'): ViewDefinition {
  return {
    viewId: 'invoice',
    version,
    nodes: [
      createPresentationNode('title', 'Invoice'),
      {
        id: 'details',
        type: 'group',
        children: [
          createPresentationNode('summary', 'Summary'),
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
        children: [],
      },
    ],
  };
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

describe('applyPatchPlanToView', () => {
  it('returns null for empty patch plans', () => {
    const view = createInvoiceView();

    expect(applyPatchPlanToView(view, { operations: [] })).toBeNull();
  });

  it('applies append-content using canonical node ids without mutating the input view', () => {
    const view = createInvoiceView();
    const originalSnapshot = structuredClone(view);

    const patched = applyPatchPlanToView(view, {
      operations: [
        {
          kind: 'append-content',
          nodeId: 'details/body',
          text: ' with additional context',
        },
      ],
    });

    expect(patched).toMatchObject({
      viewId: 'invoice',
      version: '2',
    });
    expect(requireNode(patched as ViewDefinition, 'body')).toMatchObject({
      id: 'body',
      type: 'presentation',
      content: 'Body with additional context',
    });
    expect(view).toEqual(originalSnapshot);
  });

  it.each([
    ['1', '2'],
    ['v1', 'v2'],
    ['release', 'release-next'],
  ])(
    'bumps version %s to %s when a patch changes the tree',
    (version, expected) => {
      const patched = applyPatchPlanToView(createInvoiceView(version), {
        operations: [
          {
            kind: 'insert-node',
            parentId: 'details',
            position: {
              afterId: 'summary',
            },
            node: createPresentationNode('note', 'Note'),
          },
        ],
      });

      expect(patched?.version).toBe(expected);
    }
  );

  it.each([
    {
      label: 'invalid move destinations',
      plan: {
        operations: [
          {
            kind: 'move-node' as const,
            nodeId: 'body',
            parentId: 'title',
          },
        ],
      },
    },
    {
      label: 'missing remove targets',
      plan: {
        operations: [
          {
            kind: 'remove-node' as const,
            nodeId: 'missing',
          },
        ],
      },
    },
    {
      label: 'wrap operations with missing siblings',
      plan: {
        operations: [
          {
            kind: 'wrap-nodes' as const,
            parentId: null,
            nodeIds: ['title', 'missing'],
            wrapper: {
              id: 'content_row',
              type: 'row',
              children: [],
            },
          },
        ],
      },
    },
  ])(
    'returns null when runtime patching produces a no-op for $label',
    ({ plan }) => {
      expect(applyPatchPlanToView(createInvoiceView('v1'), plan)).toBeNull();
    }
  );

  it('returns null when sequential operations land back on the original tree', () => {
    const view = createInvoiceView('v7');

    const patched = applyPatchPlanToView(view, {
      operations: [
        {
          kind: 'move-node',
          nodeId: 'body',
          parentId: 'sidebar',
          position: {
            index: 0,
          },
        },
        {
          kind: 'move-node',
          nodeId: 'body',
          parentId: 'details',
          position: {
            afterId: 'summary',
          },
        },
      ],
    });

    expect(patched).toBeNull();
  });
});
