import { describe, expect, it, vi } from 'vitest';
import { runContinuumExecution, streamContinuumExecution } from './index.js';

describe('continuum execution fallback behavior', () => {
  it('keeps localized add-field requests on the patch path when planner targets are missing', async () => {
    const currentView = {
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
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            fallback: 'view',
            reason: 'localized edit',
          }),
        };
      }

      if (request.mode === 'patch') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            operations: [
              {
                kind: 'insert-node',
                parentId: 'profile',
                position: { afterId: 'email' },
                node: {
                  id: 'budget',
                  type: 'field',
                  dataType: 'string',
                  key: 'lead.budget',
                  label: 'Budget',
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Add a budget input under email.',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('patch');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'patch',
    ]);
    expect(result).toMatchObject({
      patchPlan: {
        mode: 'patch',
        operations: [
          expect.objectContaining({
            kind: 'insert-node',
            parentId: 'profile',
          }),
        ],
      },
    });
  });

  it('keeps value-only requests on the state path when planner targets are missing', async () => {
    const currentView = {
      viewId: 'lead-form',
      version: '1',
      nodes: [
        {
          id: 'profile',
          type: 'group',
          children: [
            {
              id: 'company',
              type: 'field',
              dataType: 'string',
              key: 'lead.company',
              label: 'Company',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'state',
            fallback: 'view',
            reason: 'populate existing field',
          }),
        };
      }

      if (request.mode === 'state') {
        return {
          text: JSON.stringify({
            updates: [
              {
                key: 'lead.company',
                value: 'Acme Corp',
              },
            ],
            status: 'Updated company',
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Repopulate the company field with Acme Corp.',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('state');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'state',
    ]);
    expect(result).toMatchObject({
      updates: [
        {
          nodeId: 'profile/company',
          value: { value: 'Acme Corp' },
        },
      ],
    });
  });

  it('threads conversation summary and detached fields into planner prompts for referential restore requests', async () => {
    const currentView = {
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
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        expect(request.systemPrompt).toContain('Restore continuity context');
        expect(request.userMessage).toContain(
          'Recent conversation summary (bounded):'
        );
        expect(request.userMessage).toContain(
          'Assistant removed phone and notes fields.'
        );
        expect(request.userMessage).toContain(
          'Detached fields (restore continuity):'
        );
        expect(request.userMessage).toContain('detached:phone');
        return {
          text: JSON.stringify({
            mode: 'view',
            fallback: 'view',
            reason: 'continuity restore',
            authoringMode: 'evolve-view',
          }),
        };
      }

      if (request.mode === 'view') {
        return {
          text: `view viewId="lead-form" version="1"
group id="profile"
  field id="email" key="lead.email" label="Email" dataType="string"`,
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'You got rid of a bunch of my stuff — bring it back.',
      context: {
        currentView,
        currentData: {},
        conversationSummary: 'Assistant removed phone and notes fields.',
        detachedFields: [
          {
            detachedKey: 'detached:phone',
            previousNodeType: 'field',
            reason: 'node-removed',
            viewVersion: '0',
            valuePreview: '555',
          },
        ],
      },
    });

    expect(result.mode).toBe('view');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'view',
    ]);
  });

  it('retries state once when populate yields only empty values then succeeds', async () => {
    const currentView = {
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
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    let stateCalls = 0;
    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'state',
            fallback: 'view',
            reason: 'populate',
          }),
        };
      }

      if (request.mode === 'state') {
        stateCalls += 1;
        if (stateCalls === 1) {
          return {
            text: JSON.stringify({
              updates: [{ key: 'lead.email', value: '' }],
            }),
          };
        }
        return {
          text: JSON.stringify({
            updates: [{ key: 'lead.email', value: 'jordan@example.com' }],
            status: 'Filled email',
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'populate the email',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('state');
    expect(stateCalls).toBe(2);
    expect(
      generate.mock.calls.filter(([request]) => request.mode === 'state').length
    ).toBe(2);
    expect(result).toMatchObject({
      updates: [
        {
          nodeId: 'profile/email',
          value: { value: 'jordan@example.com' },
        },
      ],
    });
  });

  it('retries patch once when structural instruction yields no operations then succeeds', async () => {
    const currentView = {
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
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    let patchCalls = 0;
    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            fallback: 'view',
            reason: 'add field',
          }),
        };
      }

      if (request.mode === 'patch') {
        patchCalls += 1;
        if (patchCalls === 1) {
          return {
            text: JSON.stringify({
              mode: 'patch',
              operations: [],
            }),
          };
        }
        return {
          text: JSON.stringify({
            mode: 'patch',
            operations: [
              {
                kind: 'insert-node',
                parentId: 'profile',
                position: { afterId: 'email' },
                node: {
                  id: 'budget',
                  type: 'field',
                  dataType: 'string',
                  key: 'lead.budget',
                  label: 'Budget',
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Add a budget field under email.',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('patch');
    expect(patchCalls).toBe(2);
    expect(
      generate.mock.calls.filter(([request]) => request.mode === 'patch').length
    ).toBe(2);
    expect(result).toMatchObject({
      patchPlan: {
        mode: 'patch',
        operations: [
          expect.objectContaining({
            kind: 'insert-node',
            parentId: 'profile',
          }),
        ],
      },
    });
  });

  it('routes schema-evolution requests through transform mode with continuity metadata', async () => {
    const currentView = {
      viewId: 'tax-form',
      version: '2',
      nodes: [
        {
          id: 'tax_form',
          type: 'group',
          children: [
            {
              id: 'name_row',
              type: 'row',
              children: [
                {
                  id: 'first_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'first_name',
                  label: 'First name',
                },
                {
                  id: 'last_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'last_name',
                  label: 'Last name',
                },
              ],
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'transform',
            fallback: 'view',
            reason: 'merge fields',
            targetNodeIds: ['name_row'],
          }),
        };
      }

      if (request.mode === 'view') {
        return {
          text: `view viewId="tax-form" version="3"
group id="tax_form"
  field id="full_name" key="full_name" label="Full name" dataType="string"`,
        };
      }

      if (request.mode === 'transform') {
        return {
          text: JSON.stringify({
            patchOperations: [
              {
                kind: 'remove-node',
                nodeId: 'first_name',
              },
              {
                kind: 'remove-node',
                nodeId: 'last_name',
              },
              {
                kind: 'insert-node',
                parentId: 'name_row',
                node: {
                  id: 'full_name',
                  type: 'field',
                  key: 'full_name',
                  semanticKey: 'person.fullName',
                  label: 'Full name',
                  dataType: 'string',
                },
              },
            ],
            continuityOperations: [
              {
                kind: 'merge',
                sourceNodeIds: ['first_name', 'last_name'],
                targetNodeId: 'full_name',
                strategyId: 'concat-space',
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Make first name and last name into full name.',
      context: {
        currentView,
        currentData: {
          'tax_form/name_row/first_name': { value: 'Jordan', isDirty: true },
          'tax_form/name_row/last_name': { value: 'Lee', isDirty: true },
        },
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'transform',
    ]);
    expect(result).toMatchObject({
      mode: 'transform',
      transformPlan: {
        operations: [
          {
            kind: 'merge',
            sourceNodeIds: ['first_name', 'last_name'],
            targetNodeId: 'full_name',
            strategyId: 'concat-space',
          },
        ],
      },
    });
  });

  it('uses create-view authoring when the planner marks a request as a new workflow', async () => {
    const currentView = {
      viewId: 'vercel-ai-sdk-demo',
      version: 'baseline',
      nodes: [
        {
          id: 'demo_request',
          type: 'group',
          label: 'Request a demo',
          children: [
            {
              id: 'full_name',
              type: 'field',
              dataType: 'string',
              key: 'lead.fullName',
              label: 'Full name',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'view',
            fallback: 'view',
            reason: 'new workflow/domain request',
            authoringMode: 'create-view',
          }),
        };
      }

      if (request.mode === 'view') {
        expect(request.userMessage).not.toContain('Current view:');
        return {
          text: `view viewId="tax-form" version="1"
group id="tax_form" label="Tax form"
  field id="ssn" key="tax.ssn" label="Social Security number" dataType="string"`,
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'I want a tax form instead.',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'view',
    ]);
    expect(result).toMatchObject({
      mode: 'view',
      view: {
        viewId: 'tax-form',
        version: '1',
      },
    });
  });

  it('runs the planner when there is no current view (only view mode available)', async () => {
    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'view',
            fallback: 'view',
            authoringMode: 'create-view',
            reason: 'greenfield',
          }),
        };
      }

      if (request.mode === 'view') {
        return {
          text: `view viewId="solo" version="1"
group id="root" label="Hello"`,
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Create a simple form',
      context: {},
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'view',
    ]);
    expect(result).toMatchObject({
      mode: 'view',
      view: {
        viewId: 'solo',
        version: '1',
      },
    });
  });

  it('returns a warning noop when a patch plan contains unsupported operations', async () => {
    const currentView = {
      viewId: 'tax-form',
      version: '2',
      nodes: [
        {
          id: 'tax_form',
          type: 'group',
          children: [
            {
              id: 'name_row',
              type: 'row',
              children: [
                {
                  id: 'first_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'first_name',
                  label: 'First name',
                },
                {
                  id: 'last_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'last_name',
                  label: 'Last name',
                },
              ],
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'planner') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            fallback: 'view',
            reason: 'merge name fields',
          }),
        };
      }

      if (request.mode === 'patch') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            operations: [
              {
                kind: 'remove-node',
                nodeId: 'first_name',
              },
              {
                kind: 'replace-node',
                nodeId: '',
                node: {
                  id: 'full_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'full_name',
                  label: 'Full name',
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Replace first and last name with a full name field.',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'planner',
      'patch',
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        mode: 'noop',
        level: 'warning',
        requestedMode: 'patch',
        status: 'Patch update could not be applied; no changes were made.',
        reason: 'Patch operation 2 was invalid or unsupported.',
      })
    );
  });

  it('does not emit view-preview events when emitViewPreviews is false', async () => {
    const kinds: string[] = [];
    const adapter = {
      label: 'test',
      async *streamText(request: { mode?: string }) {
        expect(request.mode).toBe('view');
        yield 'view viewId="t" version="1"\n';
        yield 'group id="g" label="G"\n';
        yield '  field id="f" key="f" semanticKey="a.b" label="F" dataType="string"\n';
      },
    };

    for await (const event of streamContinuumExecution({
      adapter,
      instruction: 'make a form',
      autoApplyView: false,
      emitViewPreviews: false,
    })) {
      kinds.push(event.kind);
    }

    expect(kinds.filter((k) => k === 'view-preview')).toHaveLength(0);
    expect(kinds.some((k) => k === 'view-final')).toBe(true);
  });

  it('throttles view-preview events when viewPreviewThrottleMs is high', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    let previewCount = 0;
    const adapter = {
      label: 'test',
      async *streamText(request: { mode?: string }) {
        expect(request.mode).toBe('view');
        yield 'view viewId="t" version="1"\n';
        yield 'group id="g" label="G"\n';
        yield '  field id="f" key="f" semanticKey="a.b" label="F" dataType="string"\n';
      },
    };

    for await (const event of streamContinuumExecution({
      adapter,
      instruction: 'make a form',
      autoApplyView: false,
      viewPreviewThrottleMs: 9999,
    })) {
      if (event.kind === 'view-preview') {
        previewCount += 1;
      }
    }

    vi.restoreAllMocks();
    expect(previewCount).toBe(2);
  });
});
