import { describe, expect, it } from 'vitest';
import {
  buildContinuumPatchTargetCatalog,
  buildContinuumStateTargetCatalog,
  parseContinuumStateResponse,
} from './index.js';

describe('execution target entrypoint', () => {
  it('re-exports the catalog builders and parser', () => {
    const view = {
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'email',
          type: 'field',
          key: 'person.email',
          semanticKey: 'person.email',
          dataType: 'string',
        },
      ],
    };

    const stateCatalog = buildContinuumStateTargetCatalog(view);
    const patchCatalog = buildContinuumPatchTargetCatalog(view);
    const parsed = parseContinuumStateResponse({
      text: JSON.stringify({
        updates: [
          {
            semanticKey: 'person.email',
            value: 'jordan@example.com',
          },
        ],
      }),
      targetCatalog: stateCatalog,
    });

    expect(stateCatalog).toHaveLength(1);
    expect(patchCatalog).toHaveLength(1);
    expect(parsed?.updates).toEqual([
      {
        nodeId: 'email',
        value: { value: 'jordan@example.com' },
      },
    ]);
  });
});
