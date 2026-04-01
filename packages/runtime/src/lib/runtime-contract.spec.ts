import type { DataSnapshot, ViewDefinition } from '@continuum-dev/contract';
import { describe, expect, it } from 'vitest';
import {
  applyContinuumNodeValueWrite,
  applyContinuumViewUpdate,
  decideContinuumNodeValueWrite,
} from '../index.js';
import { reconcile } from './reconcile/index.js';

const aiFlexibleProtection = {
  owner: 'ai',
  stage: 'flexible',
} as const;

const userFlexibleProtection = {
  owner: 'user',
  stage: 'flexible',
} as const;

describe('runtime contract', () => {
  it('keeps helper surfaces off the root barrel', async () => {
    const root = await import('../index.js');
    expect('sanitizeContinuumDataSnapshot' in root).toBe(false);
    expect('collectCanonicalNodeIds' in root).toBe(false);
    expect('applyContinuumViewStreamPart' in root).toBe(false);
    expect('findRestoreCandidates' in root).toBe(false);
    expect('applyContinuumViewPatch' in root).toBe(false);
    expect('patchViewDefinition' in root).toBe(false);
  });

  it('DataSnapshot does not carry viewContext on the canonical shape', () => {
    const snap: DataSnapshot = {
      values: {},
      lineage: {
        timestamp: 1,
        sessionId: 's',
        viewId: 'v1',
        viewVersion: '1',
      },
    };
    expect('viewContext' in snap).toBe(false);
  });

  it('direct user value updates write semantic snapshot state without carrying viewport fields', () => {
    const view: ViewDefinition = {
      viewId: 'v1',
      version: '1',
      nodes: [{ id: 'a', type: 'field', dataType: 'string' }],
    };
    const priorData = {
      values: {
        a: { value: 'old' },
      },
      viewContext: {
        a: { isFocused: true },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'sess',
        viewId: 'v1',
        viewVersion: '1',
      },
    } as unknown as DataSnapshot;

    const result = applyContinuumNodeValueWrite({
      view,
      data: priorData,
      nodeId: 'a',
      value: { value: 'new' },
      sessionId: 'sess',
      timestamp: 2,
      interactionId: 'int-1',
    });

    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') {
      expect(result.data.values['a']).toEqual({
        value: 'new',
        protection: aiFlexibleProtection,
      });
      expect(result.data.lineage).toMatchObject({
        timestamp: 2,
        sessionId: 'sess',
        viewId: 'v1',
        viewVersion: '1',
        lastInteractionId: 'int-1',
      });
      expect('viewContext' in result.data).toBe(false);
    }
  });

  it('non-user value writes do not silently overwrite dirty values', () => {
    const view: ViewDefinition = {
      viewId: 'v1',
      version: '1',
      nodes: [{ id: 'a', type: 'field', dataType: 'string' }],
    };
    const currentData: DataSnapshot = {
      values: {
        a: { value: 'typed', isDirty: true },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'sess',
        viewId: 'v1',
        viewVersion: '1',
      },
    };

    const decision = decideContinuumNodeValueWrite({
      view,
      data: currentData,
      nodeId: 'a',
    });

    expect(decision.kind).toBe('proposal');
  });

  it('structural view transitions reconcile prior view and carry values when compatible', () => {
    const priorView: ViewDefinition = {
      viewId: 'v1',
      version: '1',
      nodes: [
        {
          id: 'a',
          type: 'field',
          dataType: 'string',
        },
      ],
    };
    const newView: ViewDefinition = {
      viewId: 'v1',
      version: '1',
      nodes: [
        {
          id: 'a',
          type: 'field',
          dataType: 'string',
        },
        {
          id: 'b',
          type: 'field',
          dataType: 'string',
        },
      ],
    };
    const priorData: DataSnapshot = {
      values: {
        a: { value: 'x' },
      },
      lineage: {
        timestamp: 10,
        sessionId: 'sess',
        viewId: 'v1',
        viewVersion: '1',
      },
    };
    const result = reconcile({
      newView,
      priorView,
      priorData,
      options: { clock: () => 11 },
    });
    expect(result.reconciledState.values.a?.value).toBe('x');
    expect(
      result.diffs.some((d) => d.type === 'added' && d.nodeId === 'b')
    ).toBe(true);
  });

  it('structural updates return canonical snapshot data even when legacy fields exist on prior data', () => {
    const baseView: ViewDefinition = {
      viewId: 'v1',
      version: '1',
      nodes: [{ id: 'a', type: 'field', dataType: 'string' }],
    };
    const nextView: ViewDefinition = {
      viewId: 'v1',
      version: '2',
      nodes: [
        { id: 'a', type: 'field', dataType: 'string' },
        { id: 'b', type: 'field', dataType: 'string' },
      ],
    };
    const baseData = {
      values: {
        a: { value: 'typed', isDirty: true },
      },
      viewContext: {
        a: { scrollX: 12 },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'sess',
        viewId: 'v1',
        viewVersion: '1',
      },
    } as unknown as DataSnapshot;

    const applied = applyContinuumViewUpdate({
      baseView,
      baseData,
      nextView,
      sessionId: 'sess',
      clock: () => 2,
    });

    expect(applied.data.values['a']).toEqual({
      value: 'typed',
      isDirty: true,
      protection: userFlexibleProtection,
    });
    expect('viewContext' in applied.data).toBe(false);
  });
});
