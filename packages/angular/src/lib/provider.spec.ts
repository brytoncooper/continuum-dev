import { describe, expect, it, beforeEach, afterEach } from 'vitest';
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

    const raw = localStorage.getItem('continuum_session');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.currentData?.values?.field).toEqual({ value: 'persisted' });
  });
});
