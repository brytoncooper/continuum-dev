import type { NodeValue } from '@continuum-dev/contract';
import type {
  PlaygroundConflictReplayState,
  PlaygroundConflictScenario,
} from '../types';
import { findScopedNodeIdByKey, findScopedNodeIdsByKey } from './view-helpers';

function buildStatus(stepIndex: number): string {
  if (stepIndex === 0) {
    return 'User data staged';
  }

  return 'User values overwritten';
}

export function replayNaiveOverwriteScenario(
  scenario: PlaygroundConflictScenario,
  stepIndex: number,
  initialValues: Record<string, NodeValue>
): PlaygroundConflictReplayState {
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  let currentView = scenario.steps[boundedStepIndex].view;

  const initialNodeIds = findScopedNodeIdsByKey(
    scenario.steps[0].view,
    scenario.trackedFields.map((field) => field.key)
  );

  let values: Record<string, NodeValue> = {};

  for (const field of scenario.trackedFields) {
    const initialNodeId = initialNodeIds[field.key];
    const initialValue = initialValues[field.key];
    if (initialNodeId && initialValue) {
      values[initialNodeId] = initialValue;
    }
  }

  if (boundedStepIndex > 0) {
    currentView = scenario.steps[boundedStepIndex].view;
    const currentNodeIds = findScopedNodeIdsByKey(
      currentView,
      scenario.trackedFields.map((field) => field.key)
    );

    values = {};

    for (const field of scenario.trackedFields) {
      const currentNodeId = currentNodeIds[field.key];
      const proposedValue = scenario.proposedValues[field.key];
      const initialValue = initialValues[field.key];

      if (!currentNodeId) {
        continue;
      }

      values[currentNodeId] = proposedValue
        ? { ...proposedValue, isDirty: true }
        : initialValue;
    }
  }

  return {
    view: currentView,
    values,
    trackedFields: scenario.trackedFields.map((field) => {
      const nodeId = findScopedNodeIdByKey(currentView, field.key);
      return {
        key: field.key,
        label: field.label,
        nodeId,
        value: nodeId ? values[nodeId] : undefined,
      };
    }),
    status: buildStatus(boundedStepIndex),
  };
}
