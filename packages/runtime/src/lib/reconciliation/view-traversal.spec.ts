import { describe, expect, it } from 'vitest';
import type { ViewNode } from '@continuum-dev/contract';
import { ISSUE_CODES } from '@continuum-dev/protocol';
import { traverseViewNodes } from './view-traversal/index.js';

function makeField(id: string): ViewNode {
  return {
    id,
    type: 'field',
    dataType: 'string',
  };
}

function makeGroup(id: string, children: ViewNode[]): ViewNode {
  return {
    id,
    type: 'group',
    children,
  };
}

describe('traverseViewNodes', () => {
  it('visits nodes in deterministic DFS order with stable ids and paths', () => {
    const nodes: ViewNode[] = [
      makeGroup('root-a', [
        makeGroup('c1', [makeField('gc1')]),
        makeField('c2'),
      ]),
      makeField('root-b'),
    ];

    const result = traverseViewNodes(nodes);

    expect(
      result.visited.map((entry) => ({
        nodeId: entry.nodeId,
        parentPath: entry.parentPath,
        depth: entry.depth,
        positionPath: entry.positionPath,
      }))
    ).toEqual([
      {
        nodeId: 'root-a',
        parentPath: '',
        depth: 0,
        positionPath: '0',
      },
      {
        nodeId: 'root-a/c1',
        parentPath: 'root-a',
        depth: 1,
        positionPath: '0.0',
      },
      {
        nodeId: 'root-a/c1/gc1',
        parentPath: 'root-a/c1',
        depth: 2,
        positionPath: '0.0.0',
      },
      {
        nodeId: 'root-a/c2',
        parentPath: 'root-a',
        depth: 1,
        positionPath: '0.1',
      },
      {
        nodeId: 'root-b',
        parentPath: '',
        depth: 0,
        positionPath: '1',
      },
    ]);
  });

  it('emits cycle issues when re-entering an active node', () => {
    const cyclic = makeGroup('cyclic', []);
    cyclic.children.push(cyclic);

    const result = traverseViewNodes([cyclic]);

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: ISSUE_CODES.VIEW_CHILD_CYCLE_DETECTED,
        nodeId: 'cyclic/cyclic',
      })
    );
  });

  it('emits max-depth issues and skips deeper descendants', () => {
    const nodes: ViewNode[] = [
      makeGroup('a', [makeGroup('b', [makeGroup('c', [makeField('d')])])]),
    ];

    const result = traverseViewNodes(nodes, 2);

    expect(result.visited.map((entry) => entry.nodeId)).toEqual(['a', 'a/b', 'a/b/c']);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: ISSUE_CODES.VIEW_MAX_DEPTH_EXCEEDED,
        nodeId: 'a/b/c/d',
      })
    );
  });

  it('supports object and positional signatures with identical results', () => {
    const nodes: ViewNode[] = [
      makeGroup('root', [makeField('child')]),
      makeField('tail'),
    ];

    const fromObject = traverseViewNodes({ nodes, maxDepth: 4 });
    const fromPositional = traverseViewNodes(nodes, 4);

    expect(fromObject).toEqual(fromPositional);
  });
});
