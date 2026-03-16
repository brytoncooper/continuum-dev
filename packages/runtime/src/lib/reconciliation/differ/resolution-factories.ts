import { DATA_RESOLUTIONS } from '@continuum-dev/protocol';
import type { ReconciliationResolution } from '../../types.js';
import type {
  CarriedResolutionInput,
  DetachedResolutionInput,
  MigratedResolutionInput,
} from './types.js';

export function addedResolution(
  nodeId: string,
  newType: string
): ReconciliationResolution {
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
  input: CarriedResolutionInput
): ReconciliationResolution {
  return {
    nodeId: input.nodeId,
    priorId: input.priorId,
    matchedBy: input.matchedBy,
    priorType: input.nodeType,
    newType: input.nodeType,
    resolution: DATA_RESOLUTIONS.CARRIED,
    priorValue: input.priorValue,
    reconciledValue: input.reconciledValue,
  };
}

export function detachedResolution(
  input: DetachedResolutionInput
): ReconciliationResolution {
  return {
    nodeId: input.nodeId,
    priorId: input.priorId,
    matchedBy: input.matchedBy,
    priorType: input.priorType,
    newType: input.newType,
    resolution: DATA_RESOLUTIONS.DETACHED,
    priorValue: input.priorValue,
    reconciledValue: undefined,
  };
}

export function migratedResolution(
  input: MigratedResolutionInput
): ReconciliationResolution {
  return {
    nodeId: input.nodeId,
    priorId: input.priorId,
    matchedBy: input.matchedBy,
    priorType: input.priorType,
    newType: input.newType,
    resolution: DATA_RESOLUTIONS.MIGRATED,
    priorValue: input.priorValue,
    reconciledValue: input.reconciledValue,
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
