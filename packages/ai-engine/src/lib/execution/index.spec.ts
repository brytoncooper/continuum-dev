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
              semanticKey: 'lead.email',
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
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
                  semanticKey: 'lead.budget',
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
      executionMode: 'patch',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('patch');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'patch',
    ]);
    expect(result).toMatchObject({
      patchPlan: {
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
      executionMode: 'state',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(result.mode).toBe('state');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
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
      executionMode: 'state',
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
              semanticKey: 'lead.email',
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    let patchCalls = 0;
    const generate = vi.fn(async (request) => {
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
                  semanticKey: 'lead.budget',
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
      executionMode: 'patch',
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
                  semanticKey: 'person.firstName',
                  label: 'First name',
                },
                {
                  id: 'last_name',
                  type: 'field',
                  dataType: 'string',
                  key: 'last_name',
                  semanticKey: 'person.lastName',
                  label: 'Last name',
                },
              ],
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
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
      executionMode: 'transform',
      context: {
        currentView,
        currentData: {
          'tax_form/name_row/first_name': { value: 'Jordan', isDirty: true },
          'tax_form/name_row/last_name': { value: 'Lee', isDirty: true },
        },
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'transform',
    ]);
    expect(result).toMatchObject({
      mode: 'transform',
      view: {
        version: '2.1',
      },
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

  it('bumps transform-only executions to a minor revision even when the structure is unchanged', async () => {
    const currentView = {
      viewId: 'lead-form',
      version: '2',
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
              semanticKey: 'lead.company',
              label: 'Company',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'transform') {
        return {
          text: JSON.stringify({
            continuityOperations: [
              {
                kind: 'carry',
                sourceNodeId: 'company',
                targetNodeId: 'company',
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
      instruction: 'Keep the company value on the current field.',
      executionMode: 'transform',
      context: {
        currentView,
        currentData: {
          'profile/company': { value: 'Acme Corp', isDirty: true },
        },
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'transform',
    ]);
    expect(result).toMatchObject({
      mode: 'transform',
      view: {
        version: '2.1',
      },
      transformPlan: {
        operations: [
          {
            kind: 'carry',
            sourceNodeId: 'company',
            targetNodeId: 'company',
          },
        ],
      },
    });
  });

  it('uses create-view authoring when mode is create-view for a greenfield-style instruction', async () => {
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
      if (request.mode === 'view') {
        return {
          text: `view viewId="tax-form" version="1"
group id="tax_form" label="Tax form"
  field id="ssn" key="tax.ssn" semanticKey="tax.ssn" label="Social Security number" dataType="string"`,
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
      mode: 'create-view',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
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

  it('runs view generation when there is no current view', async () => {
    const generate = vi.fn(async (request) => {
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
      executionMode: 'patch',
      context: {
        currentView,
        currentData: {},
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
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

  it('defaults to view generation when executionMode is omitted even for patch-like instructions', async () => {
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
      if (request.mode === 'view') {
        return {
          text: `view viewId="lead-form" version="2"
group id="profile"
  field id="email" key="lead.email" semanticKey="lead.email" label="Email" dataType="string"`,
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

    expect(result.mode).toBe('view');
    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'view',
    ]);
  });

  it('rejects explicit patch edits that detach populated data', async () => {
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
              semanticKey: 'lead.email',
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'patch') {
        return {
          text: JSON.stringify({
            mode: 'patch',
            operations: [
              {
                kind: 'remove-node',
                nodeId: 'email',
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
      instruction: 'Remove the email field.',
      executionMode: 'patch',
      context: {
        currentView,
        currentData: {
          'profile/email': {
            value: 'jordan@example.com',
            isDirty: true,
          },
        },
      },
    });

    expect(
      generate.mock.calls.filter(([request]) => request.mode === 'patch').length
    ).toBe(2);
    expect(result).toMatchObject({
      mode: 'noop',
      requestedMode: 'patch',
      reason: 'Runtime evaluation rejected the generated view transition.',
    });
  });

  it('routes explicit view generation through runtime evaluation before acceptance', async () => {
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
              semanticKey: 'lead.email',
              label: 'Email',
            },
          ],
        },
      ],
    } as const;

    const generate = vi.fn(async (request) => {
      if (request.mode === 'view' || request.mode === 'repair') {
        return {
          text: `view viewId="lead-form" version="2"
group id="profile"`,
        };
      }

      throw new Error(`Unexpected execution phase: ${request.mode}`);
    });

    const result = await runContinuumExecution({
      adapter: {
        label: 'test-adapter',
        generate,
      },
      instruction: 'Redesign the form.',
      executionMode: 'view',
      context: {
        currentView,
        currentData: {
          'profile/email': {
            value: 'jordan@example.com',
            isDirty: true,
          },
        },
      },
    });

    expect(generate.mock.calls.map(([request]) => request.mode)).toEqual([
      'view',
      'repair',
    ]);
    expect(result).toMatchObject({
      mode: 'noop',
      requestedMode: 'view',
      reason: 'Runtime evaluation rejected the generated view transition.',
    });
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
