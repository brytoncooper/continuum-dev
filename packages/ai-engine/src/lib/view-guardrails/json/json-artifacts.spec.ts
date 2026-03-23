import type { ViewDefinition } from '@continuum-dev/core';
import { sanitizeJsonViewDefinition } from './json-artifacts.js';

describe('sanitizeJsonViewDefinition', () => {
  it('strips a leading quote from viewId and nested string fields', () => {
    const view = {
      viewId: '"invoice_entry_form',
      version: '1',
      nodes: [
        {
          id: '"invoice_root',
          type: 'group',
          children: [
            {
              id: 'invoice_number',
              type: 'field',
              key: 'invoice_number',
              semanticKey: '"invoice.number',
              label: '"Invoice number',
              defaultValue: '"0001528-IN',
              dataType: 'string',
            },
          ],
        },
      ],
    } as unknown as ViewDefinition;

    expect(sanitizeJsonViewDefinition(view)).toEqual({
      viewId: 'invoice_entry_form',
      version: '1',
      nodes: [
        {
          id: 'invoice_root',
          type: 'group',
          children: [
            {
              id: 'invoice_number',
              type: 'field',
              key: 'invoice_number',
              semanticKey: 'invoice.number',
              label: 'Invoice number',
              defaultValue: '0001528-IN',
              dataType: 'string',
            },
          ],
        },
      ],
    });
  });

  it('is a no-op for views without leading quote artifacts', () => {
    const view: ViewDefinition = {
      viewId: 'profile',
      version: '2',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          children: [],
        },
      ],
    };

    expect(sanitizeJsonViewDefinition(view)).toEqual(view);
  });
});
