import { describe, expect, it } from 'vitest';
import { buildContinuumVercelAiSdkRequestBody } from '../index.js';

describe('buildContinuumVercelAiSdkRequestBody', () => {
  it('merges arbitrary request fields with Continuum context', () => {
    const body = buildContinuumVercelAiSdkRequestBody({
      body: {
        providerId: 'openai',
        model: 'gpt-5',
      },
      currentView: {
        viewId: 'loan-form',
        version: '1',
        nodes: [],
      },
      currentData: {
        email: { value: 'user@example.com' },
      },
      continuum: {
        instruction: 'Add an address field',
        authoringFormat: 'line-dsl',
      },
    });

    expect(body).toEqual({
      providerId: 'openai',
      model: 'gpt-5',
      currentView: {
        viewId: 'loan-form',
        version: '1',
        nodes: [],
      },
      currentData: {
        email: { value: 'user@example.com' },
      },
      continuum: {
        instruction: 'Add an address field',
        authoringFormat: 'line-dsl',
      },
    });
  });

  it('preserves explicit nulls so callers can clear request context intentionally', () => {
    const body = buildContinuumVercelAiSdkRequestBody({
      currentView: null,
      currentData: null,
    });

    expect(body).toEqual({
      currentView: null,
      currentData: null,
    });
  });

  it('includes registeredActions on the request body when provided', () => {
    const body = buildContinuumVercelAiSdkRequestBody({
      registeredActions: {
        'intent.a': { label: 'Run A', description: 'Desc' },
      },
    });

    expect(body.registeredActions).toEqual({
      'intent.a': { label: 'Run A', description: 'Desc' },
    });
  });

  it('includes integrationCatalog on the request body when provided', () => {
    const catalog = {
      productSummary: 'Test.',
      endpoints: [
        {
          id: 'e1',
          method: 'GET',
          path: '/x',
          description: 'd',
          userAction: 'act',
          persistedFields: [{ semanticKey: 'a.b', label: 'L', required: true }],
        },
      ],
    };
    const body = buildContinuumVercelAiSdkRequestBody({
      integrationCatalog: catalog,
    });

    expect(body.integrationCatalog).toEqual(catalog);
  });
});
