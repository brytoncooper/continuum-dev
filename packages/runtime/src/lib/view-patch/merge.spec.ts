import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import { patchViewDefinition, patchViewNode } from './merge.js';

function createPresentationNode(id: string, content = id): ViewNode {
  return {
    id,
    type: 'presentation',
    contentType: 'text',
    content,
  };
}

function createView(): ViewDefinition {
  return {
    viewId: 'invoice',
    version: 'v1',
    nodes: [
      createPresentationNode('title', 'Invoice'),
      {
        id: 'details',
        type: 'group',
        label: 'Details',
        children: [createPresentationNode('summary'), createPresentationNode('body')],
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
          ],
        },
      },
    ],
  };
}

describe('merge', () => {
  it('returns the next node when no previous node exists', () => {
    const nextNode = createPresentationNode('summary');

    expect(patchViewNode(undefined, nextNode)).toBe(nextNode);
  });

  it('reuses structurally identical child containers', () => {
    const previousNode = createView().nodes[1]!;
    const nextNode: ViewNode = {
      ...(previousNode as Extract<ViewNode, { type: 'group' }>),
      children: (previousNode as Extract<ViewNode, { type: 'group' }>).children.map((child) => ({
        ...child,
      })),
    };

    expect(patchViewNode(previousNode, nextNode)).toBe(previousNode);
  });

  it('reuses collection nodes when the template is structurally identical', () => {
    const previousNode = createView().nodes[2]!;
    const previousCollection = previousNode as Extract<ViewNode, { type: 'collection' }>;
    const nextNode: ViewNode = {
      ...previousCollection,
      template: {
        ...previousCollection.template,
        children: previousCollection.template.children.map((child) => ({ ...child })),
      },
    };

    expect(patchViewNode(previousNode, nextNode)).toBe(previousNode);
  });

  it('reuses moved node instances by id and type when patching a definition', () => {
    const previousView = createView();
    const nextView: ViewDefinition = {
      ...previousView,
      nodes: [previousView.nodes[2]!, previousView.nodes[0]!, previousView.nodes[1]!].map(
        (node) =>
          node.type === 'group'
            ? {
                ...node,
                children: node.children.map((child) => ({ ...child })),
              }
            : node.type === 'collection'
              ? {
                  ...node,
                  template: {
                    ...node.template,
                    children: node.template.children.map((child) => ({ ...child })),
                  },
                }
              : {
                  ...node,
                }
      ),
    };

    const patched = patchViewDefinition(previousView, nextView);

    expect(patched.nodes[0]).toBe(previousView.nodes[2]);
    expect(patched.nodes[1]).toBe(previousView.nodes[0]);
    expect(patched.nodes[2]).toBe(previousView.nodes[1]);
  });

  it('returns the next node when identity or type changes', () => {
    const previousNode = createPresentationNode('summary');
    const nextNode = createPresentationNode('body');

    expect(patchViewNode(previousNode, nextNode)).toBe(nextNode);
  });

  it('creates a new view shell when metadata changes while still reusing nodes', () => {
    const previousView = createView();
    const nextView: ViewDefinition = {
      ...previousView,
      version: 'v2',
      nodes: previousView.nodes.map((node) => ({ ...node })) as ViewNode[],
    };

    const patched = patchViewDefinition(previousView, nextView);

    expect(patched).not.toBe(previousView);
    expect(patched.version).toBe('v2');
    expect(patched.nodes).toBe(previousView.nodes);
  });
});
