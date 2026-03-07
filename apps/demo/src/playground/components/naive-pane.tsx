import type { NodeValue } from '@continuum/contract';
import { useMemo } from 'react';
import type { PlaygroundStateDropScenario } from '../types';
import { createHighlightedComponentMap } from './highlighted-node-map';
import { replayNaiveScenario } from '../state/naive-engine';
import { ComparisonPane } from './comparison-pane';
import { StaticViewRenderer } from './static-view-renderer';

export function NaivePane({
  scenario,
  stepIndex,
  userValue,
}: {
  scenario: PlaygroundStateDropScenario;
  stepIndex: number;
  userValue: string;
}) {
  const replay = replayNaiveScenario(scenario, stepIndex, userValue);
  const highlightMap = useMemo(
    () =>
      createHighlightedComponentMap(
        stepIndex === 0
          ? {}
          : {
              [scenario.trackedField.key]: {
                tone: 'error',
              },
            }
      ),
    [scenario.trackedField.key, stepIndex]
  );

  return (
    <ComparisonPane
      title="Without Continuum Reconciliation"
      description="Values are attached only to the node ids that exist in the current view."
      status={replay.status}
      semanticKey={replay.trackedField.key}
      currentNodeId={replay.trackedField.nodeId}
      storedValue={String(replay.trackedField.value?.value ?? '')}
      values={replay.values}
    >
      <StaticViewRenderer
        view={replay.view}
        values={replay.values as Record<string, NodeValue>}
        onChange={() => undefined}
        components={highlightMap}
      />
    </ComparisonPane>
  );
}
