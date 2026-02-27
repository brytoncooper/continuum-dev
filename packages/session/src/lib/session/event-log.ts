import type {
  ComponentDefinition,
  Interaction,
  ComponentState,
  ValueMeta,
} from '@continuum/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum/contract';
import type { SessionState } from './session-state.js';
import { generateId } from './session-state.js';
import { buildSnapshotFromCurrentState, notifySnapshotAndIssueListeners } from './listeners.js';
import { cloneCheckpointSnapshot } from './checkpoint-manager.js';
import { validateComponentState } from '@continuum/runtime';

function collectComponentsById(components: ComponentDefinition[]): Map<string, ComponentDefinition> {
  const byId = new Map<string, ComponentDefinition>();
  const walk = (nodes: ComponentDefinition[]) => {
    for (const node of nodes) {
      byId.set(node.id, node);
      if (node.children) {
        walk(node.children);
      }
    }
  };
  walk(components);
  return byId;
}

export function recordIntent(
  internal: SessionState,
  partial: Omit<Interaction, 'id' | 'timestamp' | 'sessionId' | 'schemaVersion'>
): void {
  if (internal.destroyed || !internal.currentState || !internal.currentSchema) return;

  const now = internal.clock();
  const id = generateId('int', internal.clock);

  const interaction: Interaction = {
    id,
    sessionId: internal.sessionId,
    schemaVersion: internal.currentSchema.version,
    timestamp: now,
    componentId: partial.componentId,
    type: partial.type,
    payload: partial.payload,
  };

  internal.eventLog.push(interaction);
  if (internal.eventLog.length > internal.maxEventLogSize) {
    internal.eventLog.splice(0, internal.eventLog.length - internal.maxEventLogSize);
  }

  const componentMap = collectComponentsById(internal.currentSchema.components);
  const componentDefinition = componentMap.get(partial.componentId);
  if (!componentDefinition) {
    internal.issues = [
      ...internal.issues,
      {
        severity: ISSUE_SEVERITY.WARNING,
        componentId: partial.componentId,
        message: `Component ${partial.componentId} not found in current schema`,
        code: ISSUE_CODES.UNKNOWN_COMPONENT,
      },
    ];
    notifySnapshotAndIssueListeners(internal);
    return;
  }

  internal.currentState = {
    ...internal.currentState,
    values: {
      ...internal.currentState.values,
      [partial.componentId]: partial.payload as ComponentState,
    },
    meta: {
      ...internal.currentState.meta,
      timestamp: now,
      lastInteractionId: id,
    },
    valuesMeta: {
      ...internal.currentState.valuesMeta,
      [partial.componentId]: {
        lastUpdated: now,
        lastInteractionId: id,
      } as ValueMeta,
    },
  };

  if (internal.validateOnUpdate) {
    const validationIssues = validateComponentState(
      componentDefinition,
      partial.payload as ComponentState
    );
    if (validationIssues.length > 0) {
      internal.issues = [...internal.issues, ...validationIssues];
    }
  }

  const lastAutoCheckpoint = [...internal.checkpoints]
    .reverse()
    .find((checkpoint) => checkpoint.kind === 'auto');
  if (lastAutoCheckpoint) {
    const snapshot = buildSnapshotFromCurrentState(internal);
    if (snapshot) {
      lastAutoCheckpoint.snapshot = cloneCheckpointSnapshot(snapshot);
    }
  }

  notifySnapshotAndIssueListeners(internal);
}
