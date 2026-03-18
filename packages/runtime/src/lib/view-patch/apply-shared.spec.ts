import type { CollectionNode, ViewNode } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import {
  insertNodeIntoList,
  replaceCollectionTemplate,
  replaceStructuralChildren,
} from './apply-shared.js';

function createPresentationNode(id: string): ViewNode {
  return {
    id,
    type: 'presentation',
    contentType: 'text',
    content: id,
  };
}

describe('apply-shared', () => {
  it('inserts relative to sibling ids when present', () => {
    const nodes = [
      createPresentationNode('summary'),
      createPresentationNode('body'),
    ];

    expect(
      insertNodeIntoList(nodes, createPresentationNode('intro'), {
        beforeId: 'body',
      }).map((node) => node.id)
    ).toEqual(['summary', 'intro', 'body']);

    expect(
      insertNodeIntoList(nodes, createPresentationNode('outro'), {
        afterId: 'summary',
      }).map((node) => node.id)
    ).toEqual(['summary', 'outro', 'body']);
  });

  it('falls back to appending when relative anchors are missing', () => {
    const nodes = [
      createPresentationNode('summary'),
      createPresentationNode('body'),
    ];

    expect(
      insertNodeIntoList(nodes, createPresentationNode('intro'), {
        beforeId: 'missing',
      }).map((node) => node.id)
    ).toEqual(['summary', 'body', 'intro']);

    expect(
      insertNodeIntoList(nodes, createPresentationNode('outro'), {
        afterId: 'missing',
      }).map((node) => node.id)
    ).toEqual(['summary', 'body', 'outro']);
  });

  it('clamps explicit indexes and treats NaN as append', () => {
    const nodes = [
      createPresentationNode('summary'),
      createPresentationNode('body'),
    ];

    expect(
      insertNodeIntoList(nodes, createPresentationNode('first'), {
        index: -5,
      }).map((node) => node.id)
    ).toEqual(['first', 'summary', 'body']);

    expect(
      insertNodeIntoList(nodes, createPresentationNode('last'), {
        index: Number.NaN,
      }).map((node) => node.id)
    ).toEqual(['summary', 'body', 'last']);
  });

  it('reuses structural containers when their children array is unchanged', () => {
    const children = [createPresentationNode('summary')];
    const group = {
      id: 'details',
      type: 'group' as const,
      label: 'Details',
      children,
    };

    expect(replaceStructuralChildren(group, children)).toBe(group);

    const nextChildren = [...children, createPresentationNode('body')];
    expect(replaceStructuralChildren(group, nextChildren)).toEqual({
      ...group,
      children: nextChildren,
    });
  });

  it('reuses collections when their template reference is unchanged', () => {
    const template = {
      id: 'line_item',
      type: 'group' as const,
      children: [createPresentationNode('name')],
    };
    const collection: CollectionNode = {
      id: 'line_items',
      type: 'collection',
      template,
    };

    expect(replaceCollectionTemplate(collection, template)).toBe(collection);

    const nextTemplate = {
      ...template,
      children: [...template.children, createPresentationNode('price')],
    };
    expect(replaceCollectionTemplate(collection, nextTemplate)).toEqual({
      ...collection,
      template: nextTemplate,
    });
  });
});
