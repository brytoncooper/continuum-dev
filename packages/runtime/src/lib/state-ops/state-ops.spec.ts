import { describe, expect, it } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import {
  applyContinuumNodeValueUpdate,
  applyContinuumViewStreamPart,
  applyContinuumViewUpdate,
  classifyContinuumValueIngress,
} from './index.js';

function makeView(
  nodes: ViewNode[],
  viewId = 'profile',
  version = '1'
): ViewDefinition {
  return { viewId, version, nodes };
}

describe('runtime state operations', () => {
  it('classifies protected values as proposals', () => {
    const view = makeView([{ id: 'email', type: 'field', dataType: 'string' }]);
    const applied = applyContinuumViewUpdate({
      baseView: null,
      baseData: null,
      nextView: view,
      sessionId: 'session-1',
      clock: () => 100,
    });
    const updated = applyContinuumNodeValueUpdate({
      view,
      data: applied.data,
      nodeId: 'email',
      value: { value: 'user@example.com', isDirty: true },
      sessionId: 'session-1',
      timestamp: 101,
      interactionId: 'int-1',
    });

    expect(updated.kind).toBe('applied');

    const decision = classifyContinuumValueIngress({
      view,
      data: updated.kind === 'applied' ? updated.data : applied.data,
      nodeId: 'email',
    });

    expect(decision.kind).toBe('proposal');
    if (decision.kind === 'proposal') {
      expect(decision.canonicalId).toBe('email');
      expect(decision.currentValue).toEqual({
        value: 'user@example.com',
        isDirty: true,
      });
    }
  });

  it('applies direct updates with canonical lineage metadata', () => {
    const view = makeView([{ id: 'name', type: 'field', dataType: 'string' }]);
    const update = applyContinuumNodeValueUpdate({
      view,
      data: null,
      nodeId: 'name',
      value: { value: 'Avery' },
      sessionId: 'session-1',
      timestamp: 123,
      interactionId: 'int-9',
      validate: true,
    });

    expect(update.kind).toBe('applied');
    if (update.kind === 'applied') {
      expect(update.data.values['name']).toEqual({ value: 'Avery' });
      expect(update.data.lineage).toMatchObject({
        sessionId: 'session-1',
        timestamp: 123,
        viewId: 'profile',
        viewVersion: '1',
        lastInteractionId: 'int-9',
      });
      expect(update.data.valueLineage?.['name']).toMatchObject({
        lastUpdated: 123,
        lastInteractionId: 'int-9',
      });
    }
  });

  it('keeps append-content incremental updates equivalent to full reconcile output', () => {
    const baseView = makeView([
      {
        id: 'intro',
        type: 'presentation',
        contentType: 'text',
        content: 'Hello',
      },
      {
        id: 'email',
        type: 'field',
        dataType: 'string',
      },
    ]);
    const baseApplied = applyContinuumViewUpdate({
      baseView: null,
      baseData: null,
      nextView: baseView,
      sessionId: 'session-1',
      clock: () => 1,
    });
    const appended = applyContinuumViewStreamPart({
      currentView: baseView,
      part: {
        kind: 'append-content',
        nodeId: 'intro',
        text: ' world',
      },
    });

    const incremental = applyContinuumViewUpdate({
      baseView,
      baseData: baseApplied.data,
      nextView: appended.view,
      sessionId: 'session-1',
      clock: () => 2,
      affectedNodeIds: appended.affectedNodeIds,
      incrementalHint: appended.incrementalHint,
      priorIssues: baseApplied.issues,
      priorDiffs: baseApplied.diffs,
      priorResolutions: baseApplied.resolutions,
    });
    const full = applyContinuumViewUpdate({
      baseView,
      baseData: baseApplied.data,
      nextView: appended.view,
      sessionId: 'session-1',
      clock: () => 2,
    });

    expect(incremental.strategy).toBe('incremental');
    expect(incremental.data).toEqual(full.data);
    expect(incremental.diffs).toEqual(full.diffs);
    expect(incremental.resolutions).toEqual(full.resolutions);
    expect(incremental.issues).toEqual(full.issues);
  });
});
