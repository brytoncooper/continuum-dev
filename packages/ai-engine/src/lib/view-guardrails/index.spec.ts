import {
  buildRuntimeErrors,
  collectStructuralErrors,
  collectUnsupportedNodeTypes,
  normalizeViewDefinition,
  parseJson,
  SUPPORTED_NODE_TYPE_VALUES,
} from '../../index.js';
import type { ViewDefinition } from '@continuum-dev/core';

describe('view-guardrails', () => {
  it('parses JSON embedded in fenced model output', () => {
    const parsed = parseJson<{ ok: boolean }>('```json\n{"ok":true}\n```');

    expect(parsed).toEqual({ ok: true });
  });

  it('collects unsupported node types and structural errors', () => {
    const nodes = [
      {
        id: 'bad',
        type: 'wizard',
      },
      {
        id: 'collection_1',
        type: 'collection',
      },
    ];

    expect(collectUnsupportedNodeTypes(nodes)).toEqual(['wizard']);
    expect(collectStructuralErrors(nodes)).toContain(
      'nodes[0] has unsupported type "wizard".'
    );
    expect(collectStructuralErrors(nodes)).toContain(
      'nodes[1] (collection) is missing template node.'
    );
  });

  it('normalizes missing defaults and duplicate ids', () => {
    const normalized = normalizeViewDefinition({
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'section',
          type: 'group',
          template: {
            id: 'field',
            type: 'field',
            key: 'person.name',
          },
        },
        {
          id: 'section',
          type: 'action',
        },
      ],
    } as unknown as ViewDefinition);

    expect(normalized.nodes[0]).toMatchObject({
      id: 'section',
      type: 'group',
      children: [{ id: 'field', type: 'field', dataType: 'string' }],
    });
    expect(normalized.nodes[1]).toMatchObject({
      id: 'section_2',
      type: 'action',
      intentId: 'section_2.submit',
      label: 'Submit',
    });
  });

  it('formats runtime issues into readable strings', () => {
    expect(buildRuntimeErrors([{ message: 'Broken' }, 42])).toEqual([
      'Broken',
      '42',
    ]);
    expect(SUPPORTED_NODE_TYPE_VALUES).toContain('collection');
  });
});
