import { describe, expect, it } from 'vitest';
import type { ViewDefinition } from '@continuum-dev/core';
import { evaluateRuntimeViewTransition } from './runtime-view-evaluator.js';

function buildCurrentView(): ViewDefinition {
  return {
    viewId: 'lead-form',
    version: '1',
    nodes: [
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'lead.email',
            semanticKey: 'lead.email',
            label: 'Email',
          },
        ],
      },
    ],
  };
}

describe('evaluateRuntimeViewTransition', () => {
  it('rejects detached field growth from a structural edit', () => {
    const currentView = buildCurrentView();
    const nextView: ViewDefinition = {
      ...currentView,
      version: '2',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [],
        },
      ],
    };

    const result = evaluateRuntimeViewTransition({
      currentView,
      nextView,
      currentData: {
        'profile/email': {
          value: 'jordan@example.com',
          isDirty: true,
        },
      },
      detachedFields: [],
    });

    expect(result.diagnostics?.metrics.detachedFieldDelta).toBe(1);
    expect(result.rejectionReason).toBe(
      'Runtime evaluation rejected the generated view transition.'
    );
  });

  it('accepts a semantic-preserving structural tweak', () => {
    const currentView = buildCurrentView();
    const nextView: ViewDefinition = {
      ...currentView,
      version: '2',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [
            {
              id: 'email',
              type: 'field',
              dataType: 'string',
              key: 'lead.email',
              semanticKey: 'lead.email',
              label: 'Email address',
            },
          ],
        },
      ],
    };

    const result = evaluateRuntimeViewTransition({
      currentView,
      nextView,
      currentData: {
        'profile/email': {
          value: 'jordan@example.com',
          isDirty: true,
        },
      },
      detachedFields: [],
    });

    expect(result.rejectionReason).toBeUndefined();
    expect(result.diagnostics?.metrics.detachedFieldDelta).toBe(0);
  });
});
