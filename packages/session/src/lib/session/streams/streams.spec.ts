import { describe, expect, it } from 'vitest';
import type {
  GroupNode,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import { createSession, deserialize } from '../../session.js';
import type { Session } from '../../types.js';

function makeView(
  nodes: ViewNode[],
  viewId = 'view-1',
  version = '1.0'
): ViewDefinition {
  return { viewId, version, nodes };
}

function makeNode(
  overrides: Partial<ViewNode> & { id: string; type?: ViewNode['type'] }
): ViewNode {
  const type = overrides.type ?? 'field';
  return {
    id: overrides.id,
    key: overrides.key,
    hash: overrides.hash,
    hidden: overrides.hidden,
    migrations: overrides.migrations,
    type,
    ...(type === 'field' ? { dataType: 'string' } : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: '' } : {}),
    ...overrides,
  } as ViewNode;
}

describe('session streams subsystem', () => {
  it('keeps committed state separate from the foreground render snapshot until commit', () => {
    const session = createSession();
    session.pushView(
      makeView(
        [
          {
            id: 'profile_group',
            type: 'group',
            children: [{ id: 'name', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
        'profile',
        '1'
      )
    );

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'patch',
      patch: {
        viewId: 'profile',
        version: '2',
        operations: [
          {
            op: 'insert-node',
            parentId: 'profile_group',
            node: {
              id: 'email',
              type: 'field',
              dataType: 'string',
              label: 'Email',
            },
          },
        ],
      },
    });

    expect(session.getSnapshot()?.view.version).toBe('2');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');

    session.commitStream(stream.streamId);

    expect(session.getCommittedSnapshot()?.view.version).toBe('2');
    const group = session.getSnapshot()?.view.nodes[0] as GroupNode;
    expect(group.children.map((child) => child.id)).toEqual(['name', 'email']);
  });

  it('keeps draft streams out of the render snapshot', () => {
    const session = createSession();
    session.pushView(makeView([makeNode({ id: 'name' })], 'profile', '1'));

    const draft = session.beginStream({
      targetViewId: 'profile',
      mode: 'draft',
    });

    session.applyStreamPart(draft.streamId, {
      kind: 'patch',
      patch: {
        viewId: 'profile',
        version: '2',
        operations: [
          {
            op: 'insert-node',
            parentId: null,
            node: {
              id: 'email',
              type: 'field',
              dataType: 'string',
            },
          },
        ],
      },
    });

    expect(session.getSnapshot()?.view.version).toBe('1');
    expect(session.getCommittedSnapshot()?.view.version).toBe('1');
    const previewStream = session
      .getStreams()
      .find((stream) => stream.streamId === draft.streamId);

    expect(previewStream).toMatchObject({
      status: 'open',
      mode: 'draft',
    });
    expect(previewStream?.previewData?.values['name']).toBeUndefined();
    expect(previewStream?.previewView?.version).toBe('2');
    expect(previewStream?.previewView?.nodes).toHaveLength(2);
  });

  it('syncs committed edits into a draft stream by semanticKey when a field moved', () => {
    const session = createSession();
    session.pushView(
      makeView(
        [
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
          } as ViewNode,
        ],
        'profile',
        '1'
      )
    );
    session.updateState('profile/email', {
      value: 'first@example.com',
      isDirty: true,
    });

    const draft = session.beginStream({
      targetViewId: 'profile',
      mode: 'draft',
    });
    session.applyStreamPart(draft.streamId, {
      kind: 'view',
      view: makeView(
        [
          {
            id: 'profile',
            type: 'group',
            children: [
              {
                id: 'contact_row',
                type: 'row',
                children: [
                  {
                    id: 'email',
                    type: 'field',
                    dataType: 'string',
                    semanticKey: 'person.email',
                  },
                ],
              },
            ],
          } as ViewNode,
        ],
        'profile',
        '2'
      ),
    });

    session.updateState('profile/email', {
      value: 'second@example.com',
      isDirty: true,
    });

    const previewStream = session
      .getStreams()
      .find((stream) => stream.streamId === draft.streamId);
    expect(
      previewStream?.previewData?.values['profile/contact_row/email']
    ).toEqual({
      value: 'second@example.com',
      isDirty: true,
    });
  });

  it('rejects a second open stream for the same target view unless superseded', () => {
    const session = createSession();
    session.pushView(makeView([makeNode({ id: 'name' })], 'profile', '1'));

    session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    expect(() =>
      session.beginStream({
        targetViewId: 'profile',
        mode: 'draft',
      })
    ).toThrow(/open stream already exists/i);
  });

  it('treats AI state updates as proposals when the committed value is protected', () => {
    const session = createSession();
    session.pushView(makeView([makeNode({ id: 'email' })], 'profile', '1'));
    session.updateState('email', { value: 'user@example.com', isDirty: true });

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'state',
      nodeId: 'email',
      value: { value: 'ai@example.com' },
    });

    expect(session.getSnapshot()?.data.values['email']).toEqual({
      value: 'user@example.com',
      isDirty: true,
    });
    expect(session.getPendingProposals()['email']).toMatchObject({
      proposedValue: { value: 'ai@example.com' },
      currentValue: { value: 'user@example.com', isDirty: true },
    });
  });

  it('preserves user edits on render-only nodes when the stream commits', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView([makeNode({ id: 'name' })], 'profile', '2'),
    });
    session.updateState('name', { value: 'typed', isDirty: true });

    expect(session.getSnapshot()?.data.values['name']).toEqual({
      value: 'typed',
      isDirty: true,
    });

    session.commitStream(stream.streamId);

    expect(session.getCommittedSnapshot()?.data.values['name']).toEqual({
      value: 'typed',
      isDirty: true,
    });
  });

  it('preserves focus across streamed structural changes when the node can be uniquely resolved', () => {
    const session = createSession();
    session.pushView(
      makeView(
        [
          {
            id: 'profile',
            type: 'group',
            children: [{ id: 'email', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
        'profile',
        '1'
      )
    );
    session.setFocusedNodeId('profile/email');

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView(
        [
          {
            id: 'profile',
            type: 'group',
            children: [
              {
                id: 'contact_row',
                type: 'row',
                children: [{ id: 'email', type: 'field', dataType: 'string' }],
              },
            ],
          } as ViewNode,
        ],
        'profile',
        '2'
      ),
    });

    expect(session.getFocusedNodeId()).toBe('profile/contact_row/email');
  });

  it('detaches user edits on render-only nodes when the stream aborts', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView([makeNode({ id: 'name' })], 'profile', '2'),
    });
    session.updateState('name', { value: 'typed', isDirty: true });

    session.abortStream(stream.streamId, 'cancelled');

    expect(session.getSnapshot()?.view.version).toBe('1');
    const detached = Object.values(session.getDetachedValues());
    expect(detached).toHaveLength(1);
    expect(detached[0]?.value).toEqual({ value: 'typed', isDirty: true });
  });

  it('clears focus when a foreground stream removes the focused node', () => {
    const session = createSession();
    const received: (string | null)[] = [];
    session.pushView(
      makeView(
        [
          {
            id: 'profile',
            type: 'group',
            children: [{ id: 'email', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
        'profile',
        '1'
      )
    );
    session.onFocusChange((id) => received.push(id));
    session.setFocusedNodeId('profile/email');

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView(
        [
          {
            id: 'profile',
            type: 'group',
            children: [],
          } as ViewNode,
        ],
        'profile',
        '2'
      ),
    });

    expect(session.getFocusedNodeId()).toBeNull();
    expect(received).toEqual(['profile/email', null]);
  });

  it('fails stale commits deterministically without mutating committed state', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView([makeNode({ id: 'email' })], 'profile', '2'),
    });
    session.updateState('email', { value: 'ai@example.com', isDirty: true });

    session.pushView(makeView([], 'profile', '3'));

    const result = session.commitStream(stream.streamId);

    expect(result.status).toBe('stale');
    expect(session.getCommittedSnapshot()?.view.version).toBe('3');
    expect(
      session.getCommittedSnapshot()?.data.values['email']
    ).toBeUndefined();
  });

  it('notifies stream listeners when a stream lifecycle changes', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));
    const updates: Array<ReturnType<Session['getStreams']>> = [];
    session.onStreams((streams) => {
      updates.push(streams);
    });

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'status',
      status: 'building',
    });
    session.abortStream(stream.streamId, 'cancelled');

    expect(updates).toHaveLength(3);
    expect(updates[0]?.[0]).toMatchObject({
      streamId: stream.streamId,
      status: 'open',
    });
    expect(updates[2]?.[0]).toMatchObject({
      streamId: stream.streamId,
      status: 'aborted',
    });
  });

  it('applies richer structural stream parts through the streaming foundation', () => {
    const session = createSession();
    session.pushView(
      makeView(
        [
          {
            id: 'profile_group',
            type: 'group',
            children: [{ id: 'name', type: 'field', dataType: 'string' }],
          } as ViewNode,
        ],
        'profile',
        '1'
      )
    );

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'insert-node',
      parentId: 'profile_group',
      node: {
        id: 'email',
        type: 'field',
        dataType: 'string',
      },
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'replace-node',
      nodeId: 'email',
      node: {
        id: 'email',
        type: 'presentation',
        contentType: 'text',
        content: 'Ready',
      },
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'remove-node',
      nodeId: 'name',
    });

    const renderGroup = session.getSnapshot()?.view.nodes[0] as GroupNode;
    expect(renderGroup.children.map((child) => child.id)).toEqual(['email']);
    expect(renderGroup.children[0]).toMatchObject({
      type: 'presentation',
      content: 'Ready',
    });

    session.commitStream(stream.streamId);

    const committedGroup = session.getCommittedSnapshot()?.view
      .nodes[0] as GroupNode;
    expect(committedGroup.children.map((child) => child.id)).toEqual(['email']);
    expect(committedGroup.children[0]).toMatchObject({
      type: 'presentation',
      content: 'Ready',
    });
  });

  it('streams append-content updates without rebuilding committed state first', () => {
    const session = createSession();
    session.pushView(
      makeView(
        [
          {
            id: 'intro',
            type: 'presentation',
            contentType: 'text',
            content: 'Hello',
          },
        ],
        'profile',
        '1'
      )
    );

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });

    session.applyStreamPart(stream.streamId, {
      kind: 'append-content',
      nodeId: 'intro',
      text: ' world',
    });

    expect(
      (
        session.getSnapshot()?.view.nodes[0] as Extract<
          ViewNode,
          { type: 'presentation' }
        >
      ).content
    ).toBe('Hello world');
    expect(
      (
        session.getCommittedSnapshot()?.view.nodes[0] as Extract<
          ViewNode,
          { type: 'presentation' }
        >
      ).content
    ).toBe('Hello');

    session.commitStream(stream.streamId);

    expect(
      (
        session.getCommittedSnapshot()?.view.nodes[0] as Extract<
          ViewNode,
          { type: 'presentation' }
        >
      ).content
    ).toBe('Hello world');
  });

  it('surfaces node-status metadata for active streams without mutating snapshots', () => {
    const session = createSession();
    session.pushView(makeView([makeNode({ id: 'name' })], 'profile', '1'));

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'node-status',
      nodeId: 'name',
      status: 'ready',
      level: 'success',
      subtree: true,
    });

    const activeStream = session
      .getStreams()
      .find((candidate) => candidate.streamId === stream.streamId);
    expect(activeStream?.nodeStatuses['name']).toEqual({
      status: 'ready',
      level: 'success',
      subtree: true,
    });
    expect(session.getSnapshot()?.data.values['name']).toBeUndefined();
  });

  it('keeps stream overlays out of serialized durable state', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView([makeNode({ id: 'name' })], 'profile', '2'),
    });
    session.updateState('name', { value: 'typed', isDirty: true });

    const serialized = session.serialize() as Record<string, unknown>;

    expect(serialized).not.toHaveProperty('streams');
    expect(serialized).not.toHaveProperty('activeForegroundStreamId');

    const restored = deserialize(serialized);
    expect(restored.getStreams()).toEqual([]);
    expect(restored.getSnapshot()?.view.version).toBe('1');
    expect(restored.getSnapshot()?.data.values['name']).toBeUndefined();
  });

  it('clears active streams and notifies stream listeners on reset', () => {
    const session = createSession();
    session.pushView(makeView([], 'profile', '1'));

    const streamUpdates: Array<ReturnType<Session['getStreams']>> = [];
    session.onStreams((streams) => {
      streamUpdates.push(streams);
    });

    const stream = session.beginStream({
      targetViewId: 'profile',
      mode: 'foreground',
    });
    session.applyStreamPart(stream.streamId, {
      kind: 'view',
      view: makeView([makeNode({ id: 'name' })], 'profile', '2'),
    });

    session.reset();

    expect(session.getStreams()).toEqual([]);
    expect(streamUpdates.at(-1)).toEqual([]);
  });
});
