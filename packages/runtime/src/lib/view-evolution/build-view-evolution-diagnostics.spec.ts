import { describe, expect, it } from 'vitest';
import type { ViewDefinition } from '@continuum-dev/contract';
import { ISSUE_CODES } from '@continuum-dev/protocol';
import { buildViewEvolutionDiagnostics } from './build-view-evolution-diagnostics.js';
import { shouldRejectAiEditDiagnostics } from './should-reject-ai-edit.js';

function field(
  id: string,
  semanticKey: string
): ViewDefinition['nodes'][number] {
  return {
    id,
    type: 'field',
    dataType: 'string',
    semanticKey,
  };
}

describe('buildViewEvolutionDiagnostics', () => {
  it('flags missing semanticKey on stateful nodes in the next view', () => {
    const priorView: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [field('a', 'email')],
    };
    const nextView: ViewDefinition = {
      viewId: 'v',
      version: '2',
      nodes: [
        {
          id: 'a',
          type: 'field',
          dataType: 'string',
        },
      ],
    };
    const result = buildViewEvolutionDiagnostics({ priorView, nextView });
    expect(
      result.issues.some(
        (i) => i.code === ISSUE_CODES.SEMANTIC_KEY_MISSING_STATEFUL
      )
    ).toBe(true);
    expect(shouldRejectAiEditDiagnostics(result)).toBe(true);
  });

  it('accepts a minimal semantic-preserving field tweak', () => {
    const priorView: ViewDefinition = {
      viewId: 'v',
      version: '1',
      nodes: [field('a', 'email')],
    };
    const nextView: ViewDefinition = {
      viewId: 'v',
      version: '2',
      nodes: [
        {
          id: 'a',
          type: 'field',
          dataType: 'string',
          semanticKey: 'email',
          label: 'Email address',
        },
      ],
    };
    const result = buildViewEvolutionDiagnostics({ priorView, nextView });
    expect(
      result.issues.filter((i) => i.code === ISSUE_CODES.SEMANTIC_KEY_CHURN)
    ).toHaveLength(0);
    expect(result.metrics.replacementRatio).toBe(0);
    expect(shouldRejectAiEditDiagnostics(result)).toBe(false);
  });
});
