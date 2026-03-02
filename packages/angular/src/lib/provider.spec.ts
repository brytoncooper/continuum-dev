import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { Injector } from '@angular/core';
import { createSession } from '@continuum/session';
import type { ViewDefinition } from '@continuum/contract';
import { provideContinuum } from './provider.js';
import { CONTIUUM_SESSION } from './tokens.js';

const view: ViewDefinition = {
  viewId: 'test',
  version: '1',
  nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
};

describe('provideContinuum', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('provides session and creates working injector', () => {
    const nodeMap = {};
    const injector = Injector.create({
      providers: provideContinuum({
        components: nodeMap,
        persist: false,
      }),
    });

    const session = injector.get(CONTIUUM_SESSION);
    expect(session).toBeDefined();
    expect(session.getSnapshot()).toBeNull();

    session.pushView(view);
    expect(session.getSnapshot()?.view.viewId).toBe('test');
  });

  it('hydrates from localStorage when persist is localStorage', () => {
    const seed = createSession();
    seed.pushView(view);
    seed.updateState('field', { value: 'from-storage' });
    localStorage.setItem('continuum_session', JSON.stringify(seed.serialize()));

    const nodeMap = {};
    const injector = Injector.create({
      providers: [
        ...provideContinuum({
          components: nodeMap,
          persist: 'localStorage',
        }),
      ],
    });

    const session = injector.get(CONTIUUM_SESSION);
    const snap = session.getSnapshot();
    expect(snap).not.toBeNull();
    expect(snap?.data.values['field']).toEqual({ value: 'from-storage' });
  });

  it('persists to localStorage on snapshot change', () => {
    vi.useFakeTimers();
    const nodeMap = {};
    const injector = Injector.create({
      providers: provideContinuum({
        components: nodeMap,
        persist: 'localStorage',
      }),
    });

    const session = injector.get(CONTIUUM_SESSION);
    session.pushView(view);
    session.updateState('field', { value: 'persisted' });
    vi.runAllTimers();

    const raw = localStorage.getItem('continuum_session');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.currentData?.values?.field).toEqual({ value: 'persisted' });
  });

  it('skips persistence and reports size_limit when payload exceeds maxPersistBytes', () => {
    vi.useFakeTimers();
    const errors: Array<Record<string, unknown>> = [];
    const nodeMap = {};
    const injector = Injector.create({
      providers: provideContinuum({
        components: nodeMap,
        persist: 'localStorage',
        maxPersistBytes: 1,
        onPersistError: (error) => {
          errors.push(error as unknown as Record<string, unknown>);
        },
      }),
    });

    const session = injector.get(CONTIUUM_SESSION);
    session.pushView(view);
    session.updateState('field', { value: 'too-large' });
    vi.runAllTimers();

    expect(localStorage.getItem('continuum_session')).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].reason).toBe('size_limit');
    expect(errors[0].key).toBe('continuum_session');
    expect(errors[0].maxBytes).toBe(1);
    expect((errors[0].attemptedBytes as number) > 1).toBe(true);
  });

  it('reports storage_error when setItem throws', () => {
    vi.useFakeTimers();
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => { throw new Error('quota exceeded'); });
    const errors: Array<Record<string, unknown>> = [];
    const nodeMap = {};
    const injector = Injector.create({
      providers: provideContinuum({
        components: nodeMap,
        persist: 'localStorage',
        onPersistError: (error) => {
          errors.push(error as unknown as Record<string, unknown>);
        },
      }),
    });

    const session = injector.get(CONTIUUM_SESSION);
    session.pushView(view);
    session.updateState('field', { value: 'persisted' });
    vi.runAllTimers();

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].reason).toBe('storage_error');
    expect(errors[0].key).toBe('continuum_session');
    expect((errors[0].cause as Error).message).toBe('quota exceeded');
    setItemSpy.mockRestore();
  });
});
