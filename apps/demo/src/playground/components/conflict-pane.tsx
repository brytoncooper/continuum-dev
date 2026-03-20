import type { NodeValue } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  type ContinuumNodeMap,
  type ContinuumNodeProps,
  useContinuumConflict,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { ConflictBanner } from '@continuum-dev/starter-kit';
import { createElement, useEffect, useMemo, type ReactNode } from 'react';
import { componentMap } from '../../component-map';
import { ExampleCard } from '../../ui/layout';
import { color, radius, space, type } from '../../ui/tokens';
import type {
  PlaygroundConflictReplayState,
  PlaygroundConflictScenario,
  PlaygroundTrackedFieldState,
} from '../types';
import { replayNaiveOverwriteScenario } from '../state/naive-overwrite-engine';
import { buildSeedValues } from '../state/scenario-inputs';
import { findScopedNodeIdByKey } from '../state/view-helpers';
import { createHighlightedComponentMap } from './highlighted-node-map';
import { StateSummaryCard } from './state-summary-card';
import { StaticViewRenderer } from './static-view-renderer';
import { TechnicalDetails } from './technical-details';

const statusRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
} as const;

const statusChipStyle = (status: string) => ({
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${
    status === 'User values overwritten' || status.endsWith('pending')
      ? color.borderStrong
      : color.border
  }`,
  background: color.surface,
});

const previewStyle = (interactive: boolean) =>
  ({
    padding: space.lg,
    borderRadius: radius.md,
    border: `1px solid ${color.borderSoft}`,
    background: color.surfaceMuted,
    pointerEvents: interactive ? 'auto' : 'none',
  } as const);

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

const detailsStyle = {
  display: 'grid',
  gap: space.md,
} as const;

const previewContentStyle = {
  display: 'grid',
  gap: space.md,
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
};

const bulkStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surfaceMuted,
} as const;

const bulkActionsStyle = {
  display: 'flex',
  gap: space.sm,
  flexWrap: 'wrap' as const,
} as const;

const inlineFieldWrapStyle = {
  display: 'grid',
  gap: space.sm,
  minWidth: 0,
} as const;

const inlineFieldControlStyle = {
  minWidth: 0,
} as const;

const inlineFieldPopupWrapStyle = {
  gap: space.md,
  paddingLeft: space.lg,
  minWidth: 0,
} as const;

const inlineFieldPopupStyle = {
  display: 'flex',
  alignItems: 'flex-start',
} as const;

const buttonStyle = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
  cursor: 'pointer',
} as const;

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? value : String(value);
}

function buildTrackedFieldStates(
  scenario: PlaygroundConflictScenario,
  view: PlaygroundConflictReplayState['view'],
  values: Record<string, NodeValue>
): PlaygroundTrackedFieldState[] {
  return scenario.trackedFields.map((field) => {
    const nodeId = findScopedNodeIdByKey(view, field.key);
    return {
      key: field.key,
      label: field.label,
      nodeId,
      value: nodeId ? values[nodeId] : undefined,
    };
  });
}

function ConflictPaneCard({
  title,
  description,
  status,
  values,
  trackedFields,
  modelDescription,
  previewHeader,
  preview,
  previewInteractive = false,
  details,
}: {
  title: string;
  description: string;
  status: string;
  values: Record<string, NodeValue>;
  trackedFields: PlaygroundTrackedFieldState[];
  modelDescription: string;
  previewHeader?: ReactNode;
  preview: ReactNode;
  previewInteractive?: boolean;
  details?: ReactNode;
}) {
  return (
    <ExampleCard title={title} description={description} span={6} fullHeight>
      <div style={contentStyle}>
        <div style={statusRowStyle}>
          <div style={statusChipStyle(status)}>{status}</div>
        </div>
        <div style={previewStyle(previewInteractive)}>
          <div style={previewContentStyle}>
            {previewHeader}
            {preview}
          </div>
        </div>
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
              title="Tracked fields"
              rows={[
                {
                  label: 'Fields in this scenario',
                  value: String(trackedFields.length),
                },
                {
                  label: 'Fields present now',
                  value: String(
                    trackedFields.filter((field) => field.nodeId).length
                  ),
                },
              ]}
            />
          </div>
        </div>
        {details ? <div style={detailsStyle}>{details}</div> : null}
        <TechnicalDetails summary="Show technical details">
          <pre style={preStyle}>{JSON.stringify(values, null, 2)}</pre>
        </TechnicalDetails>
      </div>
    </ExampleCard>
  );
}

function createConflictAwareComponentMap(): ContinuumNodeMap {
  const baseField = componentMap.field;
  const baseTextarea = componentMap.textarea;

  function ConflictAwareField(props: ContinuumNodeProps) {
    const conflict = useContinuumConflict(String(props.nodeId ?? ''));

    return (
      <div style={inlineFieldWrapStyle}>
        <div style={inlineFieldControlStyle}>
          {createElement(baseField, {
            ...props,
            onChange: () => undefined,
          })}
        </div>
        {conflict.hasConflict ? (
          <div style={inlineFieldPopupWrapStyle}>
            <div style={inlineFieldPopupStyle}>
              <ConflictBanner
                title="Suggested update"
                currentValue={stringifyValue(
                  (props.value as NodeValue | undefined)?.value
                )}
                nextValue={stringifyValue(
                  conflict.proposal?.proposedValue.value
                )}
                tone="proposal"
                variant="popover"
                onAccept={conflict.accept}
                onReject={conflict.reject}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function ConflictAwareTextarea(props: ContinuumNodeProps) {
    const conflict = useContinuumConflict(String(props.nodeId ?? ''));

    return (
      <div style={inlineFieldWrapStyle}>
        <div style={inlineFieldControlStyle}>
          {createElement(baseTextarea, {
            ...props,
            onChange: () => undefined,
          })}
        </div>
        {conflict.hasConflict ? (
          <div style={inlineFieldPopupWrapStyle}>
            <div style={inlineFieldPopupStyle}>
              <ConflictBanner
                title="Suggested update"
                currentValue={stringifyValue(
                  (props.value as NodeValue | undefined)?.value
                )}
                nextValue={stringifyValue(
                  conflict.proposal?.proposedValue.value
                )}
                tone="proposal"
                variant="popover"
                onAccept={conflict.accept}
                onReject={conflict.reject}
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return {
    ...componentMap,
    field: ConflictAwareField,
    textarea: ConflictAwareTextarea,
  };
}

const conflictComponentMap = createConflictAwareComponentMap();

function ContinuumConflictPreviewHeader({
  pendingCount,
  onAcceptAll,
  onRejectAll,
}: {
  pendingCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  if (pendingCount === 0) {
    return null;
  }

  return (
    <div style={bulkStyle}>
      <div style={{ ...type.small, color: color.textMuted }}>
        {`${pendingCount} fields are waiting on a decision.`}
      </div>
      <div style={bulkActionsStyle}>
        <button type="button" style={buttonStyle} onClick={onAcceptAll}>
          Accept all
        </button>
        <button type="button" style={buttonStyle} onClick={onRejectAll}>
          Reject all
        </button>
      </div>
    </div>
  );
}

function ContinuumConflictRuntime({
  scenario,
  stepIndex,
  initialValues,
}: {
  scenario: PlaygroundConflictScenario;
  stepIndex: number;
  initialValues: Record<string, NodeValue>;
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
    session.pushView(initialView);

    for (const field of scenario.trackedFields) {
      const nodeId = findScopedNodeIdByKey(initialView, field.key);
      const initialValue = initialValues[field.key];
      if (nodeId && initialValue) {
        session.updateState(nodeId, initialValue);
      }
    }

    for (let index = 1; index <= boundedStepIndex; index += 1) {
      const nextView = scenario.steps[index].view;
      session.pushView(nextView);

      if (index === 1) {
        for (const field of scenario.trackedFields) {
          const nodeId = findScopedNodeIdByKey(nextView, field.key);
          const proposedValue = scenario.proposedValues[field.key];
          if (nodeId && proposedValue) {
            session.proposeValue(nodeId, proposedValue, 'demo-ai');
          }
        }
      }
    }
  }, [boundedStepIndex, initialValues, scenario, session]);

  const currentView = snapshot?.view ?? scenario.steps[boundedStepIndex].view;
  const values = snapshot?.data.values ?? {};
  const trackedFields = buildTrackedFieldStates(scenario, currentView, values);
  const pendingProposals = session.getPendingProposals();
  const pendingCount = Object.keys(pendingProposals).length;

  const status =
    boundedStepIndex === 0
      ? 'User data staged'
      : pendingCount > 0
      ? `${pendingCount} proposals pending`
      : 'Proposals resolved';

  const acceptAll = () => {
    for (const nodeId of Object.keys(session.getPendingProposals())) {
      session.acceptProposal(nodeId);
    }
  };

  const rejectAll = () => {
    for (const nodeId of Object.keys(session.getPendingProposals())) {
      session.rejectProposal(nodeId);
    }
  };

  return (
    <ConflictPaneCard
      title="With Continuum Reconciliation"
      description="The same deterministic AI pass becomes real staged proposals instead of replacing the user data."
      status={status}
      values={values}
      trackedFields={trackedFields}
      modelDescription="Dirty user values stay current while Continuum stages AI proposals that can be accepted or rejected."
      previewHeader={
        boundedStepIndex > 0 ? (
          <ContinuumConflictPreviewHeader
            pendingCount={pendingCount}
            onAcceptAll={acceptAll}
            onRejectAll={rejectAll}
          />
        ) : undefined
      }
      preview={<ContinuumRenderer view={currentView} />}
      previewInteractive
    />
  );
}

export function ConflictPane({
  scenario,
  stepIndex,
  mode,
  inputValues,
}: {
  scenario: PlaygroundConflictScenario;
  stepIndex: number;
  mode: 'naive' | 'continuum';
  inputValues: Record<string, string>;
}) {
  const initialValues = useMemo(
    () => buildSeedValues(scenario.initialValues, inputValues),
    [inputValues, scenario.initialValues]
  );
  const changedFieldHighlights = useMemo(
    () =>
      stepIndex === 0
        ? {}
        : Object.fromEntries(
            Object.keys(scenario.proposedValues).map((key) => [
              key,
              {
                tone: 'error',
              } as const,
            ])
          ),
    [scenario.proposedValues, stepIndex]
  );
  const previewComponentMap = useMemo(
    () => createHighlightedComponentMap(changedFieldHighlights, componentMap),
    [changedFieldHighlights]
  );

  if (mode === 'continuum') {
    return (
      <ContinuumProvider components={conflictComponentMap} persist={false}>
        <ContinuumConflictRuntime
          scenario={scenario}
          stepIndex={stepIndex}
          initialValues={initialValues}
        />
      </ContinuumProvider>
    );
  }

  const replay = replayNaiveOverwriteScenario(
    scenario,
    stepIndex,
    initialValues
  );

  return (
    <ConflictPaneCard
      title="Without Continuum Reconciliation"
      description="The same deterministic AI pass replaces user values directly as soon as the update arrives."
      status={replay.status}
      values={replay.values}
      trackedFields={replay.trackedFields}
      modelDescription="The latest incoming values win, even when the user already changed those fields."
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
