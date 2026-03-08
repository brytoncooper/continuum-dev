import { InjectionToken } from '@angular/core';
import type { Session } from '@continuum-dev/session';
import type { ContinuitySnapshot } from '@continuum-dev/contract';
import type { ContinuumNodeMap } from './types.js';
import type { Signal } from '@angular/core';

export const CONTINUUM_SESSION = new InjectionToken<Session>(
  'CONTINUUM_SESSION'
);
export const CONTINUUM_SNAPSHOT = new InjectionToken<
  Signal<ContinuitySnapshot | null>
>('CONTINUUM_SNAPSHOT');
export const CONTINUUM_NODE_MAP = new InjectionToken<ContinuumNodeMap>(
  'CONTINUUM_NODE_MAP'
);
export const CONTINUUM_WAS_HYDRATED = new InjectionToken<boolean>(
  'CONTINUUM_WAS_HYDRATED'
);
