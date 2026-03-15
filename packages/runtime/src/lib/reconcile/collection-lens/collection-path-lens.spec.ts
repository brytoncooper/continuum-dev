import { describe, expect, it } from 'vitest';
import type { NodeValue } from '@continuum-dev/contract';
import { makeNode } from '../test-fixtures.js';
import {
  findNodeByPath,
  readPathFromFirstItem,
  writePathChain,
} from './collection-path-lens.js';
import {
  cloneNodeValue,
  normalizeCollectionState,
} from './collection-state-normalizer.js';

describe('collection path lens', () => {
  it('finds nested nodes by relative template path', () => {
    const template = makeNode({
      id: 'row',
      type: 'group',
      children: [
        makeNode({
          id: 'meta',
          type: 'group',
          children: [makeNode({ id: 'owner', type: 'field', dataType: 'string' })],
        }),
      ],
    });

    const found = findNodeByPath(template, 'row/meta/owner');
    expect(found?.id).toBe('owner');
  });

  it('writes and then reads nested collection path chains', () => {
    const innerCollection = makeNode({
      id: 'children',
      type: 'collection',
      template: makeNode({
        id: 'child',
        type: 'group',
        children: [makeNode({ id: 'name', type: 'field', dataType: 'string' })],
      }),
    });
    const outerTemplate = makeNode({
      id: 'row',
      type: 'group',
      children: [innerCollection],
    });

    const initialValues: Record<string, NodeValue> = {
      'row/children': {
        value: { items: [{ values: {} }] },
      },
    };
    const sourceValue: NodeValue = { value: 'Taylor', isDirty: true };
    const written = writePathChain(
      initialValues,
      outerTemplate,
      ['row/children', 'child/name'],
      sourceValue,
      normalizeCollectionState,
      cloneNodeValue
    );

    const read = readPathFromFirstItem(
      written,
      outerTemplate,
      ['row/children', 'child/name']
    );

    expect(read).toEqual(sourceValue);
  });
});
