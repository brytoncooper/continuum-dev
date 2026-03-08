import type { NodeValue } from '@continuum-dev/contract';
import type {
  PlaygroundDetachedReplayState,
  PlaygroundDetachedScenario,
} from '../types';
import { findScopedNodeIdByKey } from './view-helpers';

function buildStatus(stepIndex: number): string {
  if (stepIndex === 0) {
    return 'User data staged';
  }

  if (stepIndex === 1) {
    return 'Naive path lost detached values';
  }

  return 'Returned fields are empty';
}

export function replayNaiveDetachedScenario(
  scenario: PlaygroundDetachedScenario,
  stepIndex: number,
  initialValues: Record<string, NodeValue>
): PlaygroundDetachedReplayState {
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  const currentView = scenario.steps[boundedStepIndex].view;
  const values: Record<string, NodeValue> = {};

  for (const field of scenario.trackedFields) {
    const nodeId = findScopedNodeIdByKey(currentView, field.key);
    if (!nodeId) {
      continue;
    }

    if (boundedStepIndex > 0 && scenario.detachedReasons[field.key]) {
      continue;
    }

    const initialValue = initialValues[field.key];
    if (initialValue) {
      values[nodeId] = initialValue;
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
