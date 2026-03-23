import type { ViewDefinition } from '@continuum-dev/core';
import { buildPatchContext } from './context.js';
import { MAX_NODE_HINTS } from '../truncate/truncate.js';

const LONG_TEXT = 'L'.repeat(220);

describe('buildPatchContext', () => {
  it('includes node hints for nested children and collection templates', () => {
    const context = buildPatchContext({
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          label: LONG_TEXT,
          description: LONG_TEXT,
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'person.email',
              semanticKey: 'person.email',
              label: 'Email',
              defaultValue: LONG_TEXT,
            },
          ],
        },
        {
          id: 'dependents',
          type: 'collection',
          label: 'Dependents',
          template: {
            id: 'dependent',
            type: 'group',
            children: [
              {
                id: 'dependent_name',
                type: 'field',
                key: 'dependent.name',
              },
            ],
          },
        },
      ],
    } as unknown as ViewDefinition);

    expect(context.nodeHints).toEqual(
      expect.arrayContaining([
        {
          path: 'profile_group',
          id: 'profile_group',
          parentPath: undefined,
          type: 'group',
          label: `${LONG_TEXT.slice(0, 180)}...`,
          description: `${LONG_TEXT.slice(0, 180)}...`,
          childrenCount: 1,
          hasTemplate: false,
        },
        {
          path: 'profile_group/email',
          id: 'email',
          parentPath: 'profile_group',
          key: 'person.email',
          semanticKey: 'person.email',
          type: 'field',
          label: 'Email',
          defaultValue: `${LONG_TEXT.slice(0, 180)}...`,
          hasTemplate: false,
        },
        {
          path: 'dependents',
          id: 'dependents',
          type: 'collection',
          label: 'Dependents',
          hasTemplate: true,
        },
        {
          path: 'dependents/dependent',
          id: 'dependent',
          parentPath: 'dependents',
          type: 'group',
          childrenCount: 1,
          hasTemplate: false,
        },
      ])
    );
  });

  it('builds a compact tree with capped children, options, and default values', () => {
    const context = buildPatchContext({
      viewId: 'limits',
      version: '1',
      nodes: [
        {
          id: 'bulk_group',
          type: 'group',
          children: Array.from({ length: 45 }, (_, index) => ({
            id: `child_${index}`,
            type: 'presentation',
            contentType: 'text',
            content: `Child ${index}`,
          })),
        },
        {
          id: 'filters',
          type: 'select',
          options: Array.from({ length: 25 }, (_, index) => ({
            value: `value_${index}`,
            label: `${LONG_TEXT}_${index}`,
          })),
          defaultValues: Array.from({ length: 6 }, (_, index) => ({
            value: index,
          })),
        },
      ],
    } as unknown as ViewDefinition);

    expect(context.compactTree[0]).toMatchObject({
      id: 'bulk_group',
      type: 'group',
      childrenTruncatedCount: 5,
    });
    expect(context.compactTree[0]?.children).toHaveLength(40);

    expect(context.compactTree[1]).toMatchObject({
      id: 'filters',
      type: 'select',
      optionsTruncatedCount: 5,
      defaultValuesTruncatedCount: 2,
    });
    expect(context.compactTree[1]?.options).toHaveLength(20);
    expect(context.compactTree[1]?.defaultValues).toHaveLength(4);
    expect(context.compactTree[1]?.options?.[0]?.label).toBe(
      `${LONG_TEXT.slice(0, 180)}...`
    );
  });

  it('caps node hints to the prompt-safe limit', () => {
    const view = {
      viewId: 'large',
      version: '1',
      nodes: Array.from({ length: MAX_NODE_HINTS + 5 }, (_, index) => ({
        id: `node_${index}`,
        type: 'presentation',
        contentType: 'text',
        content: `Node ${index}`,
      })),
    } as unknown as ViewDefinition;

    const context = buildPatchContext(view);

    expect(context.nodeHints).toHaveLength(MAX_NODE_HINTS);
    expect(context.compactTree).toHaveLength(MAX_NODE_HINTS + 5);
    expect(context.nodeHints[MAX_NODE_HINTS - 1]).toMatchObject({
      id: `node_${MAX_NODE_HINTS - 1}`,
    });
  });
});
