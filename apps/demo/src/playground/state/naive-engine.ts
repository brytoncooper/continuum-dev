import type { NodeValue } from '@continuum/contract';
import type { PlaygroundReplayState, PlaygroundStateDropScenario } from '../types';
import { collectScopedNodeIdsFromView, findScopedNodeIdByKey } from './view-helpers';

function buildStatus(stepIndex: number, inputValue: string, currentValue: NodeValue | undefined): string {
  if (!inputValue) {
    return 'Waiting for input';
  }

  if (stepIndex === 0) {
    return 'Value captured';
  }

  return currentValue ? 'State preserved' : 'State dropped';
}

export function replayNaiveScenario(
  scenario: PlaygroundStateDropScenario,
  stepIndex: number,
  inputValue: string
): PlaygroundReplayState {
  const boundedStepIndex = Math.max(0, Math.min(stepIndex, scenario.steps.length - 1));
  const initialView = scenario.steps[0].view;
  const initialNodeId = findScopedNodeIdByKey(initialView, scenario.trackedField.key);

  let values: Record<string, NodeValue> = {};
  let currentView = initialView;

  if (initialNodeId && inputValue) {
    values[initialNodeId] = {
      value: inputValue,
      isDirty: true,
    };
  }

  for (let index = 1; index <= boundedStepIndex; index += 1) {
    currentView = scenario.steps[index].view;
    const allowedNodeIds = new Set(collectScopedNodeIdsFromView(currentView));
    values = Object.fromEntries(Object.entries(values).filter(([nodeId]) => allowedNodeIds.has(nodeId)));
  }

  const currentNodeId = findScopedNodeIdByKey(currentView, scenario.trackedField.key);
  const currentValue = currentNodeId ? values[currentNodeId] : undefined;

  return {
    view: currentView,
    values,
    trackedField: {
      key: scenario.trackedField.key,
      label: scenario.trackedField.label,
      nodeId: currentNodeId,
      value: currentValue,
    },
    status: buildStatus(boundedStepIndex, inputValue, currentValue),
  };
}
