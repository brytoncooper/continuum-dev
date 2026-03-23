import type { ViewDefinition } from '@continuum-dev/core';
import { normalizeViewDefinition } from './normalize.js';

describe('normalizeViewDefinition', () => {
  it('converts container templates into children without mutating the source view', () => {
    const source = {
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          template: {
            id: 'email',
            type: 'field',
            key: 'person.email',
          },
        },
        {
          id: 'hero',
          type: 'presentation',
          contentType: 'html',
        },
      ],
    } as unknown as ViewDefinition;

    const normalized = normalizeViewDefinition(source);

    expect(normalized.nodes[0]).toMatchObject({
      id: 'profile_group',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          key: 'person.email',
          dataType: 'string',
        },
      ],
    });
    expect(normalized.nodes[0]).not.toHaveProperty('template');
    expect(normalized.nodes[1]).toMatchObject({
      id: 'hero',
      type: 'presentation',
      contentType: 'text',
      content: '',
    });
    expect(source.nodes[0]).toHaveProperty('template');
    expect(source.nodes[0]).not.toHaveProperty('children');
  });

  it('fills collection and action defaults after enforcing globally unique ids', () => {
    const normalized = normalizeViewDefinition({
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'submit',
          type: 'action',
          intentId: ' ',
          label: '  ',
        },
        {
          id: 'submit',
          type: 'collection',
        },
        {
          type: 'action',
        },
      ],
    } as unknown as ViewDefinition);

    expect(normalized.nodes[0]).toMatchObject({
      id: 'submit',
      type: 'action',
      intentId: 'submit.submit',
      label: 'Submit',
    });
    expect(normalized.nodes[1]).toMatchObject({
      id: 'submit_2',
      type: 'collection',
      template: {
        id: 'submit_2_item',
        type: 'group',
        children: [],
      },
    });
    expect(normalized.nodes[2]).toMatchObject({
      id: 'node',
      type: 'action',
      intentId: 'node.submit',
      label: 'Submit',
    });
  });
});
