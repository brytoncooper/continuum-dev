import type { CollectionNode, CollectionNodeState, NodeValue } from '@continuum-dev/core';
import { describe, expect, it } from 'vitest';
import {
  clearCollectionItemSuggestion,
  collectTemplateDefaults,
  createInitialCollectionState,
  mergeCollectionItemSuggestion,
  normalizeCollectionNodeValue,
} from './collection-state.js';

describe('renderer collection state', () => {
  it('normalizes invalid item payloads while preserving metadata', () => {
    const normalized = normalizeCollectionNodeValue({
      value: { items: ['bad'] } as unknown as CollectionNodeState,
      suggestion: {
        items: [{ values: { 'row/name': { value: 'draft' } } }],
      },
      isDirty: true,
    });

    expect(normalized).toEqual({
      value: { items: [{ values: {} }] },
      suggestion: {
        items: [{ values: { 'row/name': { value: 'draft' } } }],
      },
      isDirty: true,
    });
  });

  it('merges collection item suggestions into existing item values', () => {
    const merged = mergeCollectionItemSuggestion(
      { value: 'Ada', isDirty: true } as NodeValue,
      {
        items: [{ values: { 'row/name': { value: 'Draft Ada' } } }],
      },
      0,
      'row/name'
    );

    expect(merged).toEqual({
      value: 'Ada',
      isDirty: true,
      suggestion: 'Draft Ada',
    });
  });

  it('drops collection suggestions when the last nested suggestion is cleared', () => {
    expect(
      clearCollectionItemSuggestion(
        {
          items: [{ values: { 'row/name': { value: 'Draft Ada' } } }],
        },
        0,
        'row/name'
      )
    ).toBeUndefined();
  });

  it('builds initial collection state and nested defaults from the template tree', () => {
    const node: CollectionNode = {
      id: 'items',
      type: 'collection',
      minItems: 2,
      template: {
        id: 'row',
        type: 'group',
        children: [
          {
            id: 'name',
            type: 'field',
            dataType: 'string',
            defaultValue: 'Ada',
          },
          {
            id: 'notes',
            type: 'collection',
            minItems: 1,
            template: {
              id: 'note',
              type: 'group',
              children: [
                {
                  id: 'body',
                  type: 'field',
                  dataType: 'string',
                  defaultValue: 'hello',
                },
              ],
            },
          },
        ],
      },
    };

    expect(createInitialCollectionState(node)).toEqual({
      items: [
        {
          values: {
            'row/name': { value: 'Ada' },
            'row/notes': {
              value: {
                items: [
                  {
                    values: {
                      'note/body': { value: 'hello' },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          values: {
            'row/name': { value: 'Ada' },
            'row/notes': {
              value: {
                items: [
                  {
                    values: {
                      'note/body': { value: 'hello' },
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    });

    expect(collectTemplateDefaults(node.template)).toEqual({
      'row/name': { value: 'Ada' },
      'row/notes': {
        value: {
          items: [
            {
              values: {
                'note/body': { value: 'hello' },
              },
            },
          ],
        },
      },
    });
  });
});
