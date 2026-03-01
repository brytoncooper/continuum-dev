import { InjectionToken } from '@angular/core';
import type { Session } from '@continuum/session';
import type { ContinuitySnapshot } from '@continuum/contract';
import type { ContinuumNodeMap } from './types.js';
import type { Signal } from '@angular/core';

export const CONTIUUM_SESSION = new InjectionToken<Session>('CONTINUUM_SESSION');
export const CONTIUUM_SNAPSHOT = new InjectionToken<Signal<ContinuitySnapshot | null>>(
  'CONTINUUM_SNAPSHOT'
);
export const CONTIUUM_NODE_MAP =
  new InjectionToken<ContinuumNodeMap>('CONTINUUM_NODE_MAP');
export const CONTIUUM_WAS_HYDRATED = new InjectionToken<boolean>(
  'CONTINUUM_WAS_HYDRATED'
);
