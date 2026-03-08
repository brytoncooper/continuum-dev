import type { NodeValue } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { useEffect, useMemo } from 'react';
import { componentMap } from '../../component-map';
import { ExampleCard } from '../../ui/layout';
import { color, control, radius, space, type } from '../../ui/tokens';
import { buildSeedValues } from '../state/scenario-inputs';
import { findScopedNodeIdByKey } from '../state/view-helpers';
import type {
  PlaygroundRecoveryReplayState,
  PlaygroundRecoveryScenario,
  PlaygroundTrackedFieldState,
} from '../types';
import { createHighlightedComponentMap } from './highlighted-node-map';
import { StateSummaryCard } from './state-summary-card';
import { StaticViewRenderer } from './static-view-renderer';

const statusRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
} as const;

const statusChipStyle = (status: string) =>
  ({
    ...type.small,
    color: color.text,
    padding: `${space.sm}px ${space.md}px`,
    borderRadius: radius.pill,
    border: `1px solid ${
      status.toLowerCase().includes('no recovery')
        ? color.borderStrong
        : color.border
    }`,
    background: color.surface,
  } as const);

const previewStyle = {
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  pointerEvents: 'none',
} as const;

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
} as const;

const fullRowStyle = {
  gridColumn: '1 / -1',
} as const;

const explanationCardStyle = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
} as const;

const explanationTitleStyle = {
  ...type.label,
  color: color.textSoft,
} as const;

const explanationBodyStyle = {
  ...type.body,
  color: color.text,
} as const;

const toolStyle = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surface,
} as const;

const toolActionsStyle = {
  display: 'flex',
  gap: space.sm,
  justifyContent: 'flex-end',
  flexWrap: 'wrap' as const,
} as const;

const toolButtonStyle = {
  height: control.height,
  padding: `0 ${space.lg}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  background: color.accent,
  color: color.surface,
  cursor: 'pointer',
  justifySelf: 'end',
  ...type.body,
  fontWeight: 600,
} as const;

const preStyle = {
  ...type.small,
  color: color.text,
  margin: 0,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
} as const;

const contentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: space.lg,
  flex: 1,
  justifyContent: 'flex-start' as const,
} as const;

function buildTrackedFieldStates(
  scenario: PlaygroundRecoveryScenario,
  values: Record<string, NodeValue>,
  currentView: PlaygroundRecoveryReplayState['view']
): PlaygroundTrackedFieldState[] {
  return scenario.trackedFields.map((field) => {
    const nodeId = findScopedNodeIdByKey(currentView, field.key);
    return {
      key: field.key,
      label: field.label,
      nodeId,
      value: nodeId ? values[nodeId] : undefined,
    };
  });
}

function replayNaiveRecoveryScenario(
  scenario: PlaygroundRecoveryScenario,
  stepIndex: number,
  inputValues: Record<string, string>
): PlaygroundRecoveryReplayState {
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  const seededValues = buildSeedValues(scenario.initialValues, inputValues);
  const initialValues = Object.fromEntries(
    scenario.trackedFields.flatMap((field) => {
      const nodeId = findScopedNodeIdByKey(scenario.steps[0].view, field.key);
      const nextValue = seededValues[field.key];
      return nodeId && nextValue ? [[nodeId, nextValue]] : [];
    })
  ) as Record<string, NodeValue>;

  if (boundedStepIndex === 0) {
    return {
      view: scenario.steps[0].view,
      values: initialValues,
      trackedFields: buildTrackedFieldStates(
        scenario,
        initialValues,
        scenario.steps[0].view
      ),
      status: 'User data staged',
    };
  }

  return {
    view: scenario.steps[1].view,
    values: {},
    trackedFields: buildTrackedFieldStates(
      scenario,
      {},
      scenario.steps[1].view
    ),
    status: 'Bad update replaced the draft',
  };
}

function RecoveryPaneCard({
  title,
  description,
  status,
  modelDescription,
  trackedFields,
  checkpointCount,
  values,
  tool,
  preview,
}: {
  title: string;
  description: string;
  status: string;
  modelDescription: string;
  trackedFields: PlaygroundTrackedFieldState[];
  checkpointCount: number;
  values: Record<string, NodeValue>;
  tool?: JSX.Element;
  preview: JSX.Element;
}) {
  return (
    <ExampleCard title={title} description={description} span={6} fullHeight>
      <div style={contentStyle}>
        <div style={statusRowStyle}>
          <div style={statusChipStyle(status)}>{status}</div>
        </div>
        {tool}
        <div style={previewStyle}>{preview}</div>
        <div style={summaryGridStyle}>
          <div style={fullRowStyle}>
            <div style={explanationCardStyle}>
              <div style={explanationTitleStyle}>
                Why this pane behaves this way
              </div>
              <div style={explanationBodyStyle}>{modelDescription}</div>
            </div>
          </div>
          <div style={fullRowStyle}>
            <StateSummaryCard
              title="Recovery state"
              rows={[
                {
                  label: 'Tracked fields',
                  value: String(trackedFields.length),
                },
                {
                  label: 'Fields visible now',
                  value: String(
                    trackedFields.filter((field) => field.nodeId).length
                  ),
                },
                {
                  label: 'Fields carrying values now',
                  value: String(
                    trackedFields.filter((field) => field.value).length
                  ),
                },
                {
                  label: 'Checkpoints available',
                  value: String(checkpointCount),
                },
              ]}
            />
          </div>
        </div>
        <pre style={preStyle}>{JSON.stringify(values, null, 2)}</pre>
      </div>
    </ExampleCard>
  );
}

function ContinuumRecoveryRuntime({
  scenario,
  stepIndex,
  inputValues,
}: {
  scenario: PlaygroundRecoveryScenario;
  stepIndex: number;
  inputValues: Record<string, string>;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const seededValues = useMemo(
    () => buildSeedValues(scenario.initialValues, inputValues),
    [inputValues, scenario.initialValues]
  );
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );

  useEffect(() => {
    session.reset();
    session.pushView(scenario.steps[0].view);

    for (const field of scenario.trackedFields) {
      const nodeId = findScopedNodeIdByKey(scenario.steps[0].view, field.key);
      const nextValue = seededValues[field.key];
      if (nodeId && nextValue) {
        session.updateState(nodeId, nextValue);
      }
    }

    const checkpoint = session.checkpoint();

    if (boundedStepIndex >= 1) {
      session.pushView(scenario.steps[1].view);
    }

    if (boundedStepIndex >= 2) {
      session.rewind(checkpoint.checkpointId);
    }
  }, [boundedStepIndex, scenario, seededValues, session]);

  const currentView = snapshot?.view ?? scenario.steps[boundedStepIndex].view;
  const values = snapshot?.data.values ?? {};
  const trackedFields = buildTrackedFieldStates(scenario, values, currentView);
  const checkpoints = session.getCheckpoints();
  const latestManualCheckpoint = checkpoints
    .filter((checkpoint) => checkpoint.trigger === 'manual')
    .at(-1);
  const hasBadViewActive =
    currentView.viewId === scenario.steps[1].view.viewId &&
    currentView.version === scenario.steps[1].view.version;
  const restoreLatestCheckpoint = () => {
    if (latestManualCheckpoint) {
      session.restoreFromCheckpoint(latestManualCheckpoint);
    }
  };
  const reapplyBadUpdate = () => {
    session.pushView(scenario.steps[1].view);
  };

  return (
    <RecoveryPaneCard
      title="With Continuum Reconciliation"
      description="The session automatically keeps checkpointed versions of the timeline, so the user can restore any earlier checkpoint. This demo restores the saved checkpoint from before the bad update."
      status={
        boundedStepIndex === 0
          ? 'User data staged'
          : hasBadViewActive
          ? 'Bad update applied'
          : 'Recovered from checkpoint'
      }
      modelDescription="Continuum keeps checkpointed versions of the session timeline. The user can restore any earlier checkpoint, and each one brings back the exact view and user data captured in that version."
      trackedFields={trackedFields}
      checkpointCount={checkpoints.length}
      values={values}
      tool={
        boundedStepIndex > 0 ? (
          <div style={toolStyle}>
            <div style={explanationTitleStyle}>Snapshot tool</div>
            <div style={explanationBodyStyle}>
              Continuum can restore any earlier checkpoint. In this demo, the
              control restores the saved checkpoint the session kept before the
              bad AI update.
            </div>
            <div style={toolActionsStyle}>
              {hasBadViewActive ? (
                <button
                  type="button"
                  style={toolButtonStyle}
                  onClick={restoreLatestCheckpoint}
                >
                  Restore saved snapshot
                </button>
              ) : (
                <button
                  type="button"
                  style={toolButtonStyle}
                  onClick={reapplyBadUpdate}
                >
                  Reapply bad update
                </button>
              )}
            </div>
          </div>
        ) : undefined
      }
      preview={<ContinuumRenderer view={currentView} />}
    />
  );
}

export function RecoveryPane({
  scenario,
  stepIndex,
  mode,
  inputValues,
}: {
  scenario: PlaygroundRecoveryScenario;
  stepIndex: number;
  mode: 'naive' | 'continuum';
  inputValues: Record<string, string>;
}) {
  const previewComponentMap = useMemo(
    () =>
      createHighlightedComponentMap(
        stepIndex > 0
          ? Object.fromEntries(
              scenario.trackedFields.map((field) => [
                field.key,
                { tone: 'error' } as const,
              ])
            )
          : {}
      ),
    [scenario.trackedFields, stepIndex]
  );

  if (mode === 'continuum') {
    return (
      <ContinuumProvider components={componentMap} persist={false}>
        <ContinuumRecoveryRuntime
          scenario={scenario}
          stepIndex={stepIndex}
          inputValues={inputValues}
        />
      </ContinuumProvider>
    );
  }

  const replay = replayNaiveRecoveryScenario(scenario, stepIndex, inputValues);

  return (
    <RecoveryPaneCard
      title="Without Continuum Reconciliation"
      description="The bad update can replace the working draft, but there is no real checkpoint to rewind back to when the user wants the last good state restored."
      status={replay.status}
      modelDescription="The naive path does not keep versioned checkpoints of the form state, so once the bad update lands there is no saved version of that draft to restore."
      trackedFields={replay.trackedFields}
      checkpointCount={0}
      values={replay.values}
      tool={
        stepIndex > 0 ? (
          <div style={toolStyle}>
            <div style={explanationTitleStyle}>Snapshot tool</div>
            <div style={explanationBodyStyle}>
              There is no saved snapshot here, so the broken update cannot be
              rolled back.
            </div>
          </div>
        ) : undefined
      }
      preview={
        <StaticViewRenderer
          view={replay.view}
          values={replay.values}
          onChange={() => undefined}
          components={previewComponentMap}
        />
      }
    />
  );
}
