import { DIFF_TYPES, TRACE_ACTIONS } from '@continuum/contract';
import type { StateDiff, ReconciliationTrace } from '../types.js';

export function addedDiff(componentId: string): StateDiff {
  return {
    componentId,
    type: DIFF_TYPES.ADDED,
    newValue: undefined,
    reason: 'Component added to schema',
  };
}

export function removedDiff(componentId: string, oldValue: unknown): StateDiff {
  return {
    componentId,
    type: DIFF_TYPES.REMOVED,
    oldValue,
    reason: 'Component removed from schema',
  };
}

export function typeChangedDiff(
  componentId: string,
  oldValue: unknown,
  priorType: string,
  newType: string
): StateDiff {
  return {
    componentId,
    type: DIFF_TYPES.TYPE_CHANGED,
    oldValue,
    reason: `Type changed from ${priorType} to ${newType}`,
  };
}

export function migratedDiff(
  componentId: string,
  oldValue: unknown,
  newValue: unknown
): StateDiff {
  return {
    componentId,
    type: DIFF_TYPES.MIGRATED,
    oldValue,
    newValue,
    reason: 'Component schema changed, migration applied',
  };
}

export function addedTrace(componentId: string, newType: string): ReconciliationTrace {
  return {
    componentId,
    priorId: null,
    matchedBy: null,
    priorType: null,
    newType,
    action: TRACE_ACTIONS.ADDED,
    priorValue: undefined,
    reconciledValue: undefined,
  };
}

export function carriedTrace(
  componentId: string,
  priorId: string,
  matchedBy: 'id' | 'key',
  componentType: string,
  priorValue: unknown,
  reconciledValue: unknown
): ReconciliationTrace {
  return {
    componentId,
    priorId,
    matchedBy,
    priorType: componentType,
    newType: componentType,
    action: TRACE_ACTIONS.CARRIED,
    priorValue,
    reconciledValue,
  };
}

export function droppedTrace(
  componentId: string,
  priorId: string,
  matchedBy: 'id' | 'key' | null,
  priorType: string,
  newType: string,
  priorValue: unknown
): ReconciliationTrace {
  return {
    componentId,
    priorId,
    matchedBy,
    priorType,
    newType,
    action: TRACE_ACTIONS.DROPPED,
    priorValue,
    reconciledValue: undefined,
  };
}

export function migratedTrace(
  componentId: string,
  priorId: string,
  matchedBy: 'id' | 'key' | null,
  priorType: string,
  newType: string,
  priorValue: unknown,
  reconciledValue: unknown
): ReconciliationTrace {
  return {
    componentId,
    priorId,
    matchedBy,
    priorType,
    newType,
    action: TRACE_ACTIONS.MIGRATED,
    priorValue,
    reconciledValue,
  };
}
