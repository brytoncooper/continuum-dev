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

  it('preserves populated values when a full view update wraps existing fields into a row', () => {
    const baseView = makeView([
      {
        id: 'profile',
        type: 'group',
        key: 'profile',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
          },
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
          },
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            key: 'person.phone',
          },
        ],
      },
      {
        id: 'request',
        type: 'group',
        key: 'request',
        children: [
          {
            id: 'income_sources',
            type: 'collection',
            key: 'request.incomeSources',
            template: {
              id: 'income_source_item',
              type: 'group',
              key: 'request.incomeSources.item',
              children: [
                {
                  id: 'income_type',
                  type: 'select',
                  key: 'type',
                  label: 'Type',
                  options: [{ value: 'w2', label: 'W-2' }],
                },
                {
                  id: 'income_payer',
                  type: 'field',
                  dataType: 'string',
                  key: 'payer',
                },
                {
                  id: 'income_amount',
                  type: 'field',
                  dataType: 'number',
                  key: 'amount',
                },
              ],
            },
          },
        ],
      },
    ]);

    const baseData = {
      values: {
        'profile/full_name': { value: 'Test This', isDirty: true },
        'profile/email': { value: 'brytoncooper', isDirty: true },
        'request/income_sources': {
          value: {
            items: [
              {
                values: {
                  type: { value: 'w2', isSticky: true },
                  payer: { value: 'Employer name', isSticky: true },
                  amount: { value: '65000', isSticky: true },
                },
              },
            ],
          },
        },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'session-1',
        viewId: 'profile',
        viewVersion: '1',
      },
    };

    const nextView = makeView([
      {
        id: 'profile',
        type: 'group',
        key: 'profile',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
          },
          {
            id: 'contact_row',
            type: 'row',
            key: 'profile.contactRow',
            children: [
              {
                id: 'email',
                type: 'field',
                dataType: 'string',
                key: 'person.email',
              },
              {
                id: 'phone',
                type: 'field',
                dataType: 'string',
                key: 'person.phone',
              },
            ],
          },
        ],
      },
      baseView.nodes[1]!,
    ]);

    const applied = applyContinuumViewUpdate({
      baseView,
      baseData,
      nextView,
      sessionId: 'session-1',
      clock: () => 2,
    });

    expect(applied.data.values['profile/full_name']).toEqual({
      value: 'Test This',
      isDirty: true,
    });
    expect(applied.data.values['profile/contact_row/email']).toEqual({
      value: 'brytoncooper',
      isDirty: true,
    });
    expect(applied.data.values['request/income_sources']).toEqual(
      baseData.values['request/income_sources']
    );
  });

  it('preserves dirty values when localized wrap-nodes groups existing siblings into a row', () => {
    const baseView = makeView([
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            semanticKey: 'person.email',
          },
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            semanticKey: 'person.phone',
          },
        ],
      },
    ]);

    const baseData = {
      values: {
        'profile/email': { value: 'jordan@example.com', isDirty: true },
        'profile/phone': { value: '555-0100', isDirty: true },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'session-1',
        viewId: 'profile',
        viewVersion: '1',
      },
    };

    const streamed = applyContinuumViewStreamPart({
      currentView: baseView,
      part: {
        kind: 'wrap-nodes',
        parentId: 'profile',
        nodeIds: ['email', 'phone'],
        wrapper: {
          id: 'contact_row',
          type: 'row',
        },
      },
    });

    const applied = applyContinuumViewUpdate({
      baseView,
      baseData,
      nextView: streamed.view,
      sessionId: 'session-1',
      clock: () => 2,
      affectedNodeIds: streamed.affectedNodeIds,
      priorIssues: [],
      priorDiffs: [],
      priorResolutions: [],
    });

    const profile = applied.view.nodes[0] as { children: Array<{ id: string }> };
    expect(profile.children.map((child) => child.id)).toEqual(['contact_row']);
    expect(applied.data.values['profile/contact_row/email']).toEqual({
      value: 'jordan@example.com',
      isDirty: true,
    });
    expect(applied.data.values['profile/contact_row/phone']).toEqual({
      value: '555-0100',
      isDirty: true,
    });
  });

  it('preserves dirty values when move-node relocates a stateful field with a stable semanticKey', () => {
    const baseView = makeView([
      {
        id: 'profile',
        type: 'group',
        children: [
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            semanticKey: 'person.email',
          },
        ],
      },
      {
        id: 'contact',
        type: 'group',
        children: [],
      },
    ]);

    const baseData = {
      values: {
        'profile/email': { value: 'jordan@example.com', isDirty: true },
      },
      lineage: {
        timestamp: 1,
        sessionId: 'session-1',
        viewId: 'profile',
        viewVersion: '1',
      },
    };

    const streamed = applyContinuumViewStreamPart({
      currentView: baseView,
      part: {
        kind: 'move-node',
        nodeId: 'email',
        parentId: 'contact',
      },
    });

    const applied = applyContinuumViewUpdate({
      baseView,
      baseData,
      nextView: streamed.view,
      sessionId: 'session-1',
      clock: () => 2,
      affectedNodeIds: streamed.affectedNodeIds,
      priorIssues: [],
      priorDiffs: [],
      priorResolutions: [],
    });

    const contact = applied.view.nodes[1] as { children: Array<{ id: string }> };
    expect(contact.children.map((child) => child.id)).toEqual(['email']);
    expect(applied.data.values['contact/email']).toEqual({
      value: 'jordan@example.com',
      isDirty: true,
    });
  });
});
