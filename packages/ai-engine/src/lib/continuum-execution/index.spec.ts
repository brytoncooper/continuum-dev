import { describe, expect, it } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum-dev/core';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  normalizeContinuumSemanticIdentity,
  resolveContinuumExecutionPlan,
} from './index.mjs';

function makeView(nodes: ViewNode[], version = '1'): ViewDefinition {
  return {
    viewId: 'planner-demo',
    version,
    nodes,
  };
}

describe('continuum execution planning', () => {
  const stateTargets = [
    {
      nodeId: 'profile/full_name',
      semanticKey: 'person.fullName',
      key: 'person.fullName',
      nodeType: 'field',
    },
    {
      nodeId: 'profile/email',
      semanticKey: 'person.email',
      key: 'person.email',
      nodeType: 'field',
    },
  ];

  const patchTargets = [
    {
      nodeId: 'profile',
      key: 'profile',
      nodeType: 'group',
    },
    {
      nodeId: 'email',
      semanticKey: 'person.email',
      key: 'person.email',
      nodeType: 'field',
    },
    {
      nodeId: 'phone',
      semanticKey: 'person.phone',
      key: 'person.phone',
      nodeType: 'field',
    },
  ];

  it('documents broad workflow requests as full-view work', () => {
    const prompt = buildContinuumExecutionPlannerSystemPrompt();

    expect(prompt).toContain('"I need to do my taxes"');

    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'view',
        fallback: 'view',
        reason: 'new workflow',
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      fallback: 'view',
      validation: 'accepted',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('accepts state plans only when explicit existing targets are selected', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'state',
        fallback: 'view',
        reason: 'prefill contact details',
        targetSemanticKeys: ['person.fullName', 'person.email'],
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'state',
      validation: 'accepted',
      targetSemanticKeys: ['person.fullName', 'person.email'],
    });
  });

  it('accepts localized patch plans when explicit patch targets are selected', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'put email and phone on one line',
        targetSemanticKeys: ['person.email', 'person.phone'],
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'patch',
      validation: 'accepted',
      targetSemanticKeys: ['person.email', 'person.phone'],
    });
  });

  it('escalates value-only plans without explicit targets to view mode', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'state',
        fallback: 'view',
        reason: 'prefill this',
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      fallback: 'view',
      validation: 'missing-targets',
    });
  });

  it('escalates localized edits with unknown targets to view mode', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'move the hidden field',
        targetSemanticKeys: ['person.unknown'],
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      fallback: 'view',
      validation: 'unknown-target-semantic-key',
    });
  });
});

describe('continuum semantic identity normalization', () => {
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
    const row = normalized.view?.nodes[0] as {
      children: Array<{ children: Array<{ id: string }> }>;
    };
    expect(row.children[0]?.children[0]?.id).toBe('email');
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
});
