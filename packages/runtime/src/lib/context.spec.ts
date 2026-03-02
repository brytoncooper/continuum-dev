import { describe, it, expect } from 'vitest';
import type { ViewDefinition, ViewNode } from '@continuum/contract';
import { buildReconciliationContext, findPriorNode } from './context.js';

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
    ...(type === 'collection' ? { template: { id: `${overrides.id}-tpl`, type: 'field', dataType: 'string' } as ViewNode } : {}),
    ...(type === 'action' ? { intentId: 'intent-1', label: 'Run' } : {}),
    ...(type === 'presentation' ? { contentType: 'text', content: 'text' } : {}),
    ...overrides,
  } as ViewNode;
}

function makeView(nodes: ViewNode[], viewId = 'view-1', version = '1.0'): ViewDefinition {
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
});
