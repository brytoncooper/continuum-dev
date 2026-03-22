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
    ).toEqual(['patch', 'transform', 'view']);
    expect(
      getAvailableContinuumExecutionModes({
        hasStateTargets: true,
        hasCurrentView: true,
      })
    ).toEqual(['state', 'patch', 'transform', 'view']);
  });
});

describe('continuum execution planner prompts', () => {
  it('documents the planner contract in the system prompt', () => {
    const prompt = buildContinuumExecutionPlannerSystemPrompt();

    expect(prompt).toContain('Return exactly one JSON object and nothing else.');
    expect(prompt).toContain('Choose one mode from the provided availableModes array.');
    expect(prompt).toContain('Continuum product context:');
    expect(prompt).toContain('Treat valid modes as runtime contracts');
    expect(prompt).toContain('"Populate the email"');
    expect(prompt).toContain('"Make first name and last name into full name"');
    expect(prompt).toContain('"I need to do my taxes"');
  });

  it('builds a user prompt with trimmed instructions and summarized current data', () => {
    const longValue = 'x'.repeat(70);
    const prompt = buildContinuumExecutionPlannerUserPrompt({
      availableModes: ['state', 'patch', 'transform', 'view'],
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

    expect(prompt).toContain('["state","patch","transform","view"]');
    expect(prompt).toContain(`${'x'.repeat(57)}...`);
    expect(prompt).not.toContain(longValue);
    expect(prompt).toContain('[3 items]');
    expect(prompt).toContain('{street, city, zip, country, ...}');
    expect(prompt).toContain('browser session');
    expect(prompt).toContain('help with the current UI');
    expect(prompt).toContain('Instruction:\nPut email next to phone');
  });

  it('appends restore continuity guidance when hasRestoreContinuity is true', () => {
    expect(
      buildContinuumExecutionPlannerSystemPrompt({ hasRestoreContinuity: true })
    ).toContain('Restore continuity context');
    expect(buildContinuumExecutionPlannerSystemPrompt()).not.toContain(
      'Restore continuity context'
    );
  });

  it('includes conversation summary and detached fields in the user prompt when provided', () => {
    const prompt = buildContinuumExecutionPlannerUserPrompt({
      availableModes: ['patch', 'view'],
      patchTargets,
      stateTargets,
      compactTree: [],
      currentData: {},
      instruction: 'Bring back what you removed.',
      conversationSummary: 'Prior: user had five fields.',
      detachedFields: [
        {
          detachedKey: 'detached:notes',
          previousNodeType: 'field',
          reason: 'node-removed',
          viewVersion: '1',
        },
      ],
    });

    expect(prompt).toContain('Recent conversation summary (bounded):');
    expect(prompt).toContain('Prior: user had five fields.');
    expect(prompt).toContain('Detached fields (restore continuity):');
    expect(prompt).toContain('detached:notes');
  });
});

describe('continuum execution plan parsing', () => {
  it('parses planner JSON embedded in surrounding text and normalizes targets', () => {
    const parsed = parseContinuumExecutionPlan({
      text: `Planner output:
{"mode":"patch","reason":" move email ","fallback":"patch","targetNodeIds":[" email ","","email"],"targetSemanticKeys":[" person.email ","person.email"]}`,
      availableModes: ['patch', 'transform', 'view'],
    });

    expect(parsed).toEqual({
      mode: 'patch',
      fallback: 'patch',
      authoringMode: undefined,
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
      availableModes: ['patch', 'transform', 'view'],
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
        authoringMode: 'create-view',
        targetNodeIds: ['profile'],
        targetSemanticKeys: ['person.email'],
      }),
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      fallback: 'view',
      authoringMode: 'create-view',
      validation: 'accepted',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('defaults view authoring mode to evolve-view when the planner omits it', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'view',
        fallback: 'view',
        reason: 'broad redesign',
      }),
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'view',
      authoringMode: 'evolve-view',
      validation: 'accepted',
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
      availableModes: ['state', 'patch', 'transform', 'view'],
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
      availableModes: ['state', 'patch', 'transform', 'view'],
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
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'state',
      fallback: 'view',
      validation: 'missing-targets',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('accepts transform plans even when no localized targets are provided', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'transform',
        fallback: 'view',
        reason: 'merge name fields',
      }),
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'transform',
      fallback: 'view',
      validation: 'accepted',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('keeps localized edits in patch mode when planner semantic targets are unknown', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'move the hidden field',
        targetSemanticKeys: ['person.unknown'],
      }),
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'patch',
      fallback: 'view',
      validation: 'unknown-targets',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('keeps localized edits in patch mode when planner node targets are unknown', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: JSON.stringify({
        mode: 'patch',
        fallback: 'view',
        reason: 'move the hidden field',
        targetNodeIds: ['missing-node'],
      }),
      availableModes: ['state', 'patch', 'transform', 'view'],
      patchTargets,
      stateTargets,
    });

    expect(resolved).toMatchObject({
      mode: 'patch',
      fallback: 'view',
      validation: 'unknown-targets',
      targetNodeIds: [],
      targetSemanticKeys: [],
    });
  });

  it('falls back when the planner output cannot be parsed into an available plan', () => {
    const resolved = resolveContinuumExecutionPlan({
      text: '{"mode":"state"',
      availableModes: ['patch', 'transform', 'view'],
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
