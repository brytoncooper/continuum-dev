import { describe, expect, it } from 'vitest';
import {
  buildContinuumExecutionPlannerSystemPrompt,
  buildContinuumExecutionPlannerUserPrompt,
  getAvailableContinuumExecutionModes,
  parseContinuumExecutionPlan,
  resolveContinuumExecutionPlan,
} from './planner.mjs';

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

describe('continuum execution planner modes', () => {
  it('always includes view mode and only adds state or patch when supported', () => {
    expect(getAvailableContinuumExecutionModes()).toEqual(['view']);
    expect(
      getAvailableContinuumExecutionModes({
        hasStateTargets: true,
      })
    ).toEqual(['state', 'view']);
    expect(
      getAvailableContinuumExecutionModes({
        hasCurrentView: true,
      })
    ).toEqual(['patch', 'view']);
    expect(
      getAvailableContinuumExecutionModes({
        hasStateTargets: true,
        hasCurrentView: true,
      })
    ).toEqual(['state', 'patch', 'view']);
  });
});

describe('continuum execution planner prompts', () => {
  it('documents the planner contract in the system prompt', () => {
    const prompt = buildContinuumExecutionPlannerSystemPrompt();

    expect(prompt).toContain('Return exactly one JSON object and nothing else.');
    expect(prompt).toContain('Choose one mode from the provided availableModes array.');
    expect(prompt).toContain('"I need to do my taxes"');
  });

  it('builds a user prompt with trimmed instructions and summarized current data', () => {
    const longValue = 'x'.repeat(70);
    const prompt = buildContinuumExecutionPlannerUserPrompt({
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
      compactTree: [
        {
          id: 'profile',
          type: 'group',
          children: [
            {
              id: 'email',
              type: 'field',
            },
          ],
        },
      ],
      currentData: {
        email: {
          value: longValue,
          isDirty: true,
        },
        tags: {
          value: ['work', 'home', 'other'],
        },
        address: {
          value: {
            street: '123 Main',
            city: 'Denver',
            zip: '80202',
            country: 'US',
            region: 'CO',
          },
        },
      },
      instruction: '  Put email next to phone  ',
    });

    expect(prompt).toContain('["state","patch","view"]');
    expect(prompt).toContain(`${'x'.repeat(57)}...`);
    expect(prompt).not.toContain(longValue);
    expect(prompt).toContain('[3 items]');
    expect(prompt).toContain('{street, city, zip, country, ...}');
    expect(prompt).toContain('Instruction:\nPut email next to phone');
  });
});

describe('continuum execution plan parsing', () => {
  it('parses planner JSON embedded in surrounding text and normalizes targets', () => {
    const parsed = parseContinuumExecutionPlan({
      text: `Planner output:
{"mode":"patch","reason":" move email ","fallback":"patch","targetNodeIds":[" email ","","email"],"targetSemanticKeys":[" person.email ","person.email"]}`,
      availableModes: ['patch', 'view'],
    });

    expect(parsed).toEqual({
      mode: 'patch',
      fallback: 'patch',
      reason: 'move email',
      targetNodeIds: ['email'],
      targetSemanticKeys: ['person.email'],
    });
  });

  it('returns null when the planner selects a mode that is not available', () => {
    const parsed = parseContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'state',
        fallback: 'view',
      }),
      availableModes: ['patch', 'view'],
    });

    expect(parsed).toBeNull();
  });
});

describe('continuum execution plan resolution', () => {
  it('accepts full-view plans and clears localized targets', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'view',
        fallback: 'view',
        reason: 'new workflow',
        targetNodeIds: ['profile'],
        targetSemanticKeys: ['person.email'],
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

  it('accepts state plans only when explicit state targets are selected', () => {
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
      targetNodeIds: [],
      targetSemanticKeys: ['person.fullName', 'person.email'],
    });
  });

  it('accepts localized patch plans when explicit patch node targets are selected', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'move the profile section',
        targetNodeIds: ['profile'],
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'patch',
      validation: 'accepted',
      targetNodeIds: ['profile'],
      targetSemanticKeys: [],
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

  it('escalates localized edits with unknown semantic targets to view mode', () => {
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

  it('escalates localized edits with unknown node targets to view mode', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'move the hidden field',
        targetNodeIds: ['missing-node'],
      }),
      availableModes: ['state', 'patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      fallback: 'view',
      validation: 'unknown-target-node',
    });
  });

  it('falls back when the planner output cannot be parsed into an available plan', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: '{"mode":"state"',
      availableModes: ['patch', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toEqual({
      mode: 'view',
      fallback: 'view',
      reason: 'planner fallback',
      targetNodeIds: [],
      targetSemanticKeys: [],
      validation: 'invalid-plan',
    });
  });
});
