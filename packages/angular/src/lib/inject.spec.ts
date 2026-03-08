import { describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import type { ViewDefinition } from '@continuum-dev/contract';
import { provideContinuum } from './provider.js';
import {
  injectContinuumSession,
  injectContinuumSnapshot,
  injectContinuumState,
  injectContinuumDiagnostics,
} from './inject.js';
import { CONTINUUM_SESSION } from './tokens.js';

const view: ViewDefinition = {
  viewId: 'test',
  version: '1',
  nodes: [{ id: 'field', type: 'field', dataType: 'string' }],
};

describe('injectContinuumSession', () => {
  it('returns session from injector', () => {
    const injector = Injector.create({
      providers: provideContinuum({ components: {}, persist: false }),
    });

    const session = injector.runInContext(() => injectContinuumSession());
    expect(session).toBeDefined();
    expect(session.getSnapshot()).toBeNull();
  });

  it('throws when used outside provideContinuum', () => {
    const injector = Injector.create({ providers: [] });
    expect(() => injector.runInContext(() => injectContinuumSession())).toThrow(
      /CONTINUUM_SESSION|provideContinuum/
    );
  });
});

describe('injectContinuumSnapshot', () => {
  it('returns snapshot signal that updates on pushView', () => {
    const injector = Injector.create({
      providers: provideContinuum({ components: {}, persist: false }),
    });

    const snapshot = injector.runInContext(() => injectContinuumSnapshot());
    expect(snapshot()).toBeNull();

    const session = injector.get(CONTINUUM_SESSION);
    session.pushView(view);
    expect(snapshot()).not.toBeNull();
    expect(snapshot()?.view.viewId).toBe('test');
  });
});

describe('injectContinuumState', () => {
  it('returns state signal and setter for node id', () => {
    const injector = Injector.create({
      providers: provideContinuum({ components: {}, persist: false }),
    });

    const session = injector.get(CONTINUUM_SESSION);
    session.pushView(view);

    const [state, setState] = injector.runInContext(() =>
      injectContinuumState('field')
    );
    expect(state()).toBeUndefined();

    setState({ value: 'hello' });
    expect(state()).toEqual({ value: 'hello' });
  });
});

describe('injectContinuumDiagnostics', () => {
  it('returns diagnostics signal', () => {
    const injector = Injector.create({
      providers: provideContinuum({ components: {}, persist: false }),
    });

    const diagnostics = injector.runInContext(() =>
      injectContinuumDiagnostics()
    );
    expect(diagnostics()).toBeDefined();
    expect(diagnostics().issues).toEqual([]);
    expect(diagnostics().diffs).toEqual([]);
    expect(diagnostics().resolutions).toEqual([]);
    expect(diagnostics().checkpoints).toEqual([]);
  });
});
