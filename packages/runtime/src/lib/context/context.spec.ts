import { describe, it, expect } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum-dev/contract';
import { buildReconciliationContext, findPriorNode } from './index.js';

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
    ...(type === 'field'
      ? { dataType: 'string', defaultValue: undefined, constraints: undefined }
      : {}),
    ...(type === 'group' ? { children: [] as ViewNode[] } : {}),
    ...(type === 'collection'
      ? {
          template: {
            id: `${overrides.id}-tpl`,
            type: 'field',
            dataType: 'string',
          } as ViewNode,
        }
      : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation'
      ? { contentType: 'text', content: 'text' }
      : {}),
    ...overrides,
  } as ViewNode;
}

function makeView(
  nodes: ViewNode[],
  viewId = 'view-1',
  version = '1.0'
): ViewDefinition {
  return { viewId, version, nodes };
}

describe('buildReconciliationContext', () => {
  it('indexes flat nodes by id', () => {
    const newView = makeView([makeNode({ id: 'a' }), makeNode({ id: 'b' })]);
    const ctx = buildReconciliationContext(newView, null);
    expect(ctx.newById.size).toBe(2);
    expect(ctx.newById.get('a')?.id).toBe('a');
    expect(ctx.newById.get('b')?.id).toBe('b');
  });

  it('indexes nested group children recursively', () => {
    const newView = makeView([
      makeNode({
        id: 'group',
        type: 'group',
        children: [makeNode({ id: 'child-1' }), makeNode({ id: 'child-2' })],
      }),
    ]);
    const ctx = buildReconciliationContext(newView, null);
    expect(ctx.newById.has('group')).toBe(true);
    expect(ctx.newById.has('group/child-1')).toBe(true);
    expect(ctx.newById.has('group/child-2')).toBe(true);
  });
});

describe('findPriorNode', () => {
  it('matches by node id before key', () => {
    const priorView = makeView([makeNode({ id: 'node-1', key: 'email' })]);
    const newView = makeView([makeNode({ id: 'node-1', key: 'new-email' })]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(ctx, ctx.newById.get('node-1')!);
    expect(priorNode?.id).toBe('node-1');
  });

  it('matches by key when ids differ', () => {
    const priorView = makeView([makeNode({ id: 'old-node', key: 'email' })]);
    const newView = makeView([makeNode({ id: 'new-node', key: 'email' })]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(ctx, ctx.newById.get('new-node')!);
    expect(priorNode?.id).toBe('old-node');
  });

  it('does not match by dot-notation suffix key', () => {
    const priorView = makeView([makeNode({ id: 'node-1', key: 'firstName' })]);
    const newView = makeView([
      makeNode({ id: 'node-2', key: 'applicantName.firstName' }),
    ]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(ctx, ctx.newById.get('node-2')!);
    expect(priorNode).toBeNull();
  });

  it('does not match by unique raw id when nested deeply', () => {
    const priorView = makeView([
      makeNode({
        id: 'row-1',
        type: 'row',
        children: [makeNode({ id: 'first_name', key: 'firstName' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'group-1',
        type: 'group',
        children: [
          makeNode({
            id: 'row-2',
            type: 'row',
            children: [makeNode({ id: 'first_name', key: 'first_name' })],
          }),
        ],
      }),
    ]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(
      ctx,
      ctx.newById.get('group-1/row-2/first_name')!
    );
    expect(priorNode).toBeNull();
  });

  it('does not match by raw id if not globally unique', () => {
    const priorView = makeView([
      makeNode({
        id: 'row-1',
        type: 'row',
        children: [makeNode({ id: 'label_text', key: 't1' })],
      }),
      makeNode({
        id: 'row-2',
        type: 'row',
        children: [makeNode({ id: 'label_text', key: 't2' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'group-1',
        type: 'group',
        children: [makeNode({ id: 'label_text', key: 't3' })],
      }),
    ]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(
      ctx,
      ctx.newById.get('group-1/label_text')!
    );
    expect(priorNode).toBeNull();
  });

  it('does not match newly dot-notated key to old unique raw ID', () => {
    const priorView = makeView([
      makeNode({
        id: 'row-1',
        type: 'row',
        children: [makeNode({ id: 'first_name', key: 'firstName' })],
      }),
    ]);
    const newView = makeView([
      makeNode({
        id: 'group-1',
        type: 'group',
        children: [makeNode({ id: 'new_id', key: 'applicantName.first_name' })],
      }),
    ]);
    const ctx = buildReconciliationContext(newView, priorView);
    const priorNode = findPriorNode(ctx, ctx.newById.get('group-1/new_id')!);
    expect(priorNode).toBeNull();
  });
});
