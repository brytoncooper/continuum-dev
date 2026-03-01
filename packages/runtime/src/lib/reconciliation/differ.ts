import { VIEW_DIFFS, DATA_RESOLUTIONS } from '@continuum/contract';
import type { StateDiff, ReconciliationResolution } from '../types.js';

export function addedDiff(nodeId: string): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.ADDED,
    newValue: undefined,
    reason: 'Node added to view',
  };
}

export function removedDiff(nodeId: string, oldValue: unknown): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.REMOVED,
    oldValue,
    reason: 'Node removed from view',
  };
}

export function typeChangedDiff(
  nodeId: string,
  oldValue: unknown,
  priorType: string,
  newType: string
): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.TYPE_CHANGED,
    oldValue,
    reason: `Type changed from ${priorType} to ${newType}`,
  };
}

export function migratedDiff(
  nodeId: string,
  oldValue: unknown,
  newValue: unknown
): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.MIGRATED,
    oldValue,
    newValue,
    reason: 'Node view changed, migration applied',
  };
}

export function restoredDiff(
  nodeId: string,
  newValue: unknown
): StateDiff {
  return {
    nodeId,
    type: VIEW_DIFFS.RESTORED,
    newValue,
    reason: 'Node restored from detached values',
  };
}

export function addedResolution(nodeId: string, newType: string): ReconciliationResolution {
  return {
    nodeId,
    priorId: null,
    matchedBy: null,
    priorType: null,
    newType,
    resolution: DATA_RESOLUTIONS.ADDED,
    priorValue: undefined,
    reconciledValue: undefined,
  };
}

export function carriedResolution(
  nodeId: string,
  priorId: string,
  matchedBy: 'id' | 'key',
  nodeType: string,
  priorValue: unknown,
  reconciledValue: unknown
): ReconciliationResolution {
  return {
    nodeId,
    priorId,
    matchedBy,
    priorType: nodeType,
    newType: nodeType,
    resolution: DATA_RESOLUTIONS.CARRIED,
    priorValue,
    reconciledValue,
  };
}

export function detachedResolution(
  nodeId: string,
  priorId: string,
  matchedBy: 'id' | 'key' | null,
  priorType: string,
  newType: string,
  priorValue: unknown
): ReconciliationResolution {
  return {
    nodeId,
    priorId,
    matchedBy,
    priorType,
    newType,
    resolution: DATA_RESOLUTIONS.DETACHED,
    priorValue,
    reconciledValue: undefined,
  };
}

export function migratedResolution(
  nodeId: string,
  priorId: string,
  matchedBy: 'id' | 'key' | null,
  priorType: string,
  newType: string,
  priorValue: unknown,
  reconciledValue: unknown
): ReconciliationResolution {
  return {
    nodeId,
    priorId,
    matchedBy,
    priorType,
    newType,
    resolution: DATA_RESOLUTIONS.MIGRATED,
    priorValue,
    reconciledValue,
  };
}

export function restoredResolution(
  nodeId: string,
  priorType: string,
  reconciledValue: unknown
): ReconciliationResolution {
  return {
    nodeId,
    priorId: null,
    matchedBy: null,
    priorType,
    newType: priorType,
    resolution: DATA_RESOLUTIONS.RESTORED,
    priorValue: undefined,
    reconciledValue,
  };
}
