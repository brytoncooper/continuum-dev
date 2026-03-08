import { describe, it, expect, vi } from 'vitest';
import { createSession } from '../session.js';
import type { ViewDefinition } from '@continuum-dev/contract';

const testView: ViewDefinition = {
  viewId: 'test',
  version: '1',
  nodes: [
    { id: 'name', type: 'field', dataType: 'string' } as any,
    {
      id: 'submit_btn',
      type: 'action',
      intentId: 'do_submit',
      label: 'Submit',
    } as any,
  ],
};

function sessionWithView() {
  const session = createSession();
  session.pushView(testView);
  return session;
}

describe('dispatchAction', () => {
  it('returns ActionResult with success true for a sync handler', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, () => ({
      success: true,
      data: 'ok',
    }));

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(true);
    expect(result.data).toBe('ok');
  });

  it('returns ActionResult with success true for an async handler', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, async () => ({
      success: true,
      data: 42,
    }));

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  it('normalizes void handler return to success true', async () => {
    const session = sessionWithView();
    session.registerAction(
      'do_submit',
      { label: 'Submit' },
      () => undefined as any
    );

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(true);
  });

  it('catches handler errors and returns success false', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, () => {
      throw new Error('boom');
    });

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toBe('boom');
  });

  it('catches async handler rejections and returns success false', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, async () => {
      throw new Error('async boom');
    });

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(false);
    expect((result.error as Error).message).toBe('async boom');
  });

  it('warns and returns failure for unregistered intentId', async () => {
    const session = sessionWithView();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const result = await session.dispatchAction('nonexistent', 'submit_btn');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No handler registered');
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('returns failure when no active snapshot exists', async () => {
    const session = createSession();
    session.registerAction('do_submit', { label: 'Submit' }, () => ({
      success: true,
    }));

    const result = await session.dispatchAction('do_submit', 'submit_btn');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active snapshot');
  });
});

describe('ActionContext.session ref', () => {
  it('provides getSnapshot that returns current snapshot', async () => {
    const session = sessionWithView();
    let snapshotInHandler: unknown = null;

    session.registerAction('do_submit', { label: 'Submit' }, (ctx) => {
      snapshotInHandler = ctx.session.getSnapshot();
      return { success: true };
    });

    await session.dispatchAction('do_submit', 'submit_btn');

    expect(snapshotInHandler).not.toBeNull();
    expect((snapshotInHandler as any).view.viewId).toBe('test');
  });

  it('provides updateState that mutates session data', async () => {
    const session = sessionWithView();

    session.registerAction('do_submit', { label: 'Submit' }, (ctx) => {
      ctx.session.updateState('name', { value: 'updated-by-handler' });
      return { success: true };
    });

    await session.dispatchAction('do_submit', 'submit_btn');

    const snap = session.getSnapshot();
    expect(snap?.data.values['name']?.value).toBe('updated-by-handler');
  });

  it('provides pushView that evolves the session view', async () => {
    const session = sessionWithView();
    const v2: ViewDefinition = { viewId: 'test', version: '2', nodes: [] };

    session.registerAction('do_submit', { label: 'Submit' }, (ctx) => {
      ctx.session.pushView(v2);
      return { success: true };
    });

    await session.dispatchAction('do_submit', 'submit_btn');

    const snap = session.getSnapshot();
    expect(snap?.view.version).toBe('2');
  });

  it('provides proposeValue that stages a proposal', async () => {
    const session = sessionWithView();
    session.updateState('name', { value: 'user-typed', isDirty: true });

    session.registerAction('do_submit', { label: 'Submit' }, (ctx) => {
      ctx.session.proposeValue('name', { value: 'ai-suggested' }, 'handler');
      return { success: true };
    });

    await session.dispatchAction('do_submit', 'submit_btn');

    const proposals = session.getPendingProposals();
    expect(proposals['name']).toBeDefined();
    expect(proposals['name'].proposedValue.value).toBe('ai-suggested');
  });
});

describe('executeIntent', () => {
  it('submits intent, dispatches action, and validates on success', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, () => ({
      success: true,
    }));

    const result = await session.executeIntent({
      nodeId: 'submit_btn',
      intentName: 'do_submit',
      payload: {},
    });

    expect(result.success).toBe(true);
    const intents = session.getPendingIntents();
    expect(intents).toHaveLength(1);
    expect(intents[0].status).toBe('validated');
  });

  it('submits intent, dispatches action, and cancels on failure', async () => {
    const session = sessionWithView();
    session.registerAction('do_submit', { label: 'Submit' }, () => {
      throw new Error('fail');
    });

    const result = await session.executeIntent({
      nodeId: 'submit_btn',
      intentName: 'do_submit',
      payload: {},
    });

    expect(result.success).toBe(false);
    const intents = session.getPendingIntents();
    expect(intents).toHaveLength(1);
    expect(intents[0].status).toBe('cancelled');
  });

  it('cancels intent when no handler is registered', async () => {
    const session = sessionWithView();
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const result = await session.executeIntent({
      nodeId: 'submit_btn',
      intentName: 'missing_action',
      payload: {},
    });

    expect(result.success).toBe(false);
    const intents = session.getPendingIntents();
    expect(intents).toHaveLength(1);
    expect(intents[0].status).toBe('cancelled');
    warnSpy.mockRestore();
  });
});
