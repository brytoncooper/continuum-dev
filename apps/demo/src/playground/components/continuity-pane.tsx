import { useEffect } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import type { NodeValue } from '@continuum-dev/contract';
import { componentMap } from '../../component-map';
import type { PlaygroundStateDropScenario } from '../types';
import { findScopedNodeIdByKey } from '../state/view-helpers';
import { ComparisonPane } from './comparison-pane';

function buildStatus(
  stepIndex: number,
  inputValue: string,
  currentValue: NodeValue | undefined
): string {
  if (!inputValue) {
    return 'Waiting for input';
  }

  if (stepIndex === 0) {
    return 'Value captured';
  }

  return currentValue ? 'State preserved' : 'State dropped';
}

function ContinuityPaneRuntime({
  scenario,
  stepIndex,
  userValue,
}: {
  scenario: PlaygroundStateDropScenario;
  stepIndex: number;
  userValue: string;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );

  useEffect(() => {
    session.reset();

    const initialView = scenario.steps[0].view;
    const initialNodeId = findScopedNodeIdByKey(
      initialView,
      scenario.trackedField.key
    );

    session.pushView(initialView);

    if (initialNodeId && userValue) {
      session.updateState(initialNodeId, {
        value: userValue,
        isDirty: true,
      });
    }

    for (let index = 1; index <= boundedStepIndex; index += 1) {
      session.pushView(scenario.steps[index].view);
    }
  }, [boundedStepIndex, scenario, session, userValue]);

  const currentView = snapshot?.view ?? scenario.steps[boundedStepIndex].view;
  const currentNodeId = findScopedNodeIdByKey(
    currentView,
    scenario.trackedField.key
  );
  const currentValue = currentNodeId
    ? snapshot?.data.values[currentNodeId]
    : undefined;

  return (
    <ComparisonPane
      title="With Continuum Reconciliation"
      description="The same deterministic view sequence is replayed through real Continuum reconciliation."
      status={buildStatus(boundedStepIndex, userValue, currentValue)}
      semanticKey={scenario.trackedField.key}
      currentNodeId={currentNodeId}
      storedValue={String(currentValue?.value ?? '')}
      values={snapshot?.data.values ?? {}}
    >
      <ContinuumRenderer view={currentView} />
    </ComparisonPane>
  );
}

export function ContinuityPane({
  scenario,
  stepIndex,
  userValue,
}: {
  scenario: PlaygroundStateDropScenario;
  stepIndex: number;
  userValue: string;
}) {
  return (
    <ContinuumProvider components={componentMap} persist={false}>
      <ContinuityPaneRuntime
        scenario={scenario}
        stepIndex={stepIndex}
        userValue={userValue}
      />
    </ContinuumProvider>
  );
}
