import { describe, expect, it } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum-dev/core';
import { normalizeContinuumSemanticIdentity } from './semantic-identity.mjs';

function makeView(nodes: ViewNode[], version = '1'): ViewDefinition {
  return {
    viewId: 'planner-demo',
    version,
    nodes,
  };
}

describe('continuum semantic identity normalization', () => {
  it('passes through generated views when there is no current view to compare against', () => {
    const nextView = makeView([
      {
        id: 'email',
        type: 'field',
        dataType: 'string',
        semanticKey: 'person.email',
      },
    ]);

    const normalized = normalizeContinuumSemanticIdentity({
      nextView,
    });

    expect(normalized.errors).toEqual([]);
    expect(normalized.view).toBe(nextView);
  });

  it('preserves prior ids when a semanticKey-stable field moves across structure', () => {
    const currentView = makeView([
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            semanticKey: 'person.email',
          },
        ],
      },
    ]);

    const nextView = makeView(
      [
        {
          id: 'profile',
          type: 'group',
          children: [
            {
              id: 'contact_row',
              type: 'row',
              children: [
                {
                  id: 'primary_email',
                  type: 'field',
                  dataType: 'string',
                  key: 'person.email',
                  semanticKey: 'person.email',
                },
              ],
            },
          ],
        },
      ],
      '2'
    );

    const normalized = normalizeContinuumSemanticIdentity({
      currentView,
      nextView,
    });

    expect(normalized.errors).toEqual([]);
    expect(normalized.view).not.toBe(nextView);
    expect(
      ((nextView.nodes[0] as ViewNode & {
        children: Array<ViewNode & { children: Array<ViewNode> }>;
      }).children[0] as ViewNode & { children: Array<ViewNode> }).children[0]?.id
    ).toBe('primary_email');

    const row = normalized.view?.nodes[0] as ViewNode & {
      children: Array<ViewNode & { children: Array<ViewNode> }>;
    };
    expect((row.children[0] as ViewNode & { children: Array<ViewNode> }).children[0]?.id).toBe(
      'email'
    );
  });

  it('rejects duplicate semantic keys in the generated view', () => {
    const normalized = normalizeContinuumSemanticIdentity({
      currentView: makeView([]),
      nextView: makeView([
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          semanticKey: 'person.email',
        },
        {
          id: 'secondary_email',
          type: 'field',
          dataType: 'string',
          semanticKey: 'person.email',
        },
      ]),
    });

    expect(normalized.errors).toContain(
      'Duplicate semanticKey "person.email" in generated view.'
    );
  });

  it('rejects reused data bindings that drop semanticKey continuity', () => {
    const currentView = makeView([
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            semanticKey: 'person.email',
          },
        ],
      },
    ]);

    const nextView = makeView(
      [
        {
          id: 'profile',
          type: 'group',
          children: [
            {
              id: 'contact_row',
              type: 'row',
              children: [
                {
                  id: 'email',
                  type: 'field',
                  dataType: 'string',
                  key: 'person.email',
                },
              ],
            },
          ],
        },
      ],
      '2'
    );

    const normalized = normalizeContinuumSemanticIdentity({
      currentView,
      nextView,
    });

    expect(normalized.errors).toContain(
      'Generated view reused "person.email" without preserving semanticKey "person.email".'
    );
  });

  it('reports an error when the preserved prior id is already occupied elsewhere', () => {
    const currentView = makeView([
      {
        id: 'email',
        type: 'field',
        dataType: 'string',
        key: 'person.email',
        semanticKey: 'person.email',
      },
    ]);

    const nextView = makeView(
      [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'person.secondaryEmail',
          semanticKey: 'person.secondaryEmail',
        },
        {
          id: 'primary_email',
          type: 'field',
          dataType: 'string',
          key: 'person.email',
          semanticKey: 'person.email',
        },
      ],
      '2'
    );

    const normalized = normalizeContinuumSemanticIdentity({
      currentView,
      nextView,
    });

    expect(normalized.errors).toContain(
      'Generated view reused semanticKey "person.email" but changed the node id from "email" to "primary_email" while "email" is already occupied.'
    );
    expect((normalized.view?.nodes[1] as ViewNode).id).toBe('primary_email');
  });
});
