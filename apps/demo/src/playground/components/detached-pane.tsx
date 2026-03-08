import type { DetachedValue, NodeValue } from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { useEffect, useMemo } from 'react';
import { componentMap } from '../../component-map';
import { ExampleCard } from '../../ui/layout';
import { color, radius, space, type } from '../../ui/tokens';
import { replayNaiveDetachedScenario } from '../state/naive-detached-engine';
import { buildSeedValues } from '../state/scenario-inputs';
import { findScopedNodeIdByKey } from '../state/view-helpers';
import type {
  PlaygroundDetachedReplayState,
  PlaygroundDetachedScenario,
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

const statusChipStyle = (status: string) => ({
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${
    status.includes('lost') || status.includes('empty')
      ? color.borderStrong
      : color.border
  }`,
  background: color.surface,
});

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

const drawerStyle = {
  display: 'grid',
  gap: space.md,
} as const;

const drawerSummaryStyle = {
  ...type.small,
  color: color.text,
  cursor: 'pointer',
  listStyle: 'none',
} as const;

const drawerContentStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
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

const previewNoticeStyle = {
  ...type.small,
  color: color.text,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.borderStrong}`,
  background: color.surface,
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

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'Empty';
  }

  return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
}

function buildTrackedFieldStates(
  scenario: PlaygroundDetachedScenario,
  view: PlaygroundDetachedReplayState['view'],
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

function detachedLabel(reason: DetachedValue['reason']): string {
  return reason === 'node-removed'
    ? 'Detached on removal'
    : 'Detached on type mismatch';
}

function detachedSummary(
  detachedValues: Record<string, DetachedValue>
): Array<{ label: string; value: string }> {
  const keys = Object.keys(detachedValues);
  if (keys.length === 0) {
    return [
      { label: 'Store', value: 'No detached values are being held right now.' },
    ];
  }

  return keys.map((key) => ({
    label: `${key} (${detachedValues[key].reason})`,
    value: stringifyValue(detachedValues[key].value),
  }));
}

function continuumFieldStatus(
  scenario: PlaygroundDetachedScenario,
  stepIndex: number,
  field: PlaygroundTrackedFieldState,
  detachedValues: Record<string, DetachedValue>
): string {
  if (stepIndex === 0) {
    return 'Stable';
  }

  const detachedValue = detachedValues[field.key];
  if (detachedValue) {
    return detachedLabel(detachedValue.reason);
  }

  if (
    stepIndex === 2 &&
    scenario.restoredKeys.includes(field.key) &&
    field.value
  ) {
    return 'Restored from detached value';
  }

  return 'Stable';
}

function naiveFieldStatus(
  scenario: PlaygroundDetachedScenario,
  stepIndex: number,
  field: PlaygroundTrackedFieldState
): string {
  if (stepIndex === 0) {
    return 'Stable';
  }

  const detachedReason = scenario.detachedReasons[field.key];

  if (stepIndex === 1) {
    if (detachedReason === 'node-removed') {
      return 'Lost on naive path';
    }
    if (detachedReason === 'type-mismatch') {
      return 'Reset by new type';
    }
  }

  if (stepIndex === 2 && scenario.restoredKeys.includes(field.key)) {
    return 'Returned without prior value';
  }

  return 'Stable';
}

function DetachedPaneCard({
  title,
  description,
  status,
  modelDescription,
  values,
  trackedFields,
  detachedValues,
  fieldDetails,
  previewNotice,
  preview,
}: {
  title: string;
  description: string;
  status: string;
  modelDescription: string;
  values: Record<string, NodeValue>;
  trackedFields: PlaygroundTrackedFieldState[];
  detachedValues: Record<string, DetachedValue>;
  fieldDetails: JSX.Element;
  previewNotice?: JSX.Element;
  preview: JSX.Element;
}) {
  return (
    <ExampleCard title={title} description={description} span={6} fullHeight>
      <div style={contentStyle}>
        <div style={statusRowStyle}>
          <div style={statusChipStyle(status)}>{status}</div>
        </div>
        <div style={previewStyle}>{preview}</div>
        {previewNotice}
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
        <StateSummaryCard
          title="Detached value store"
          rows={detachedSummary(detachedValues)}
        />
        <details style={drawerStyle}>
          <summary style={drawerSummaryStyle}>Field details</summary>
          <div style={drawerContentStyle}>{fieldDetails}</div>
        </details>
        <pre style={preStyle}>{JSON.stringify(values, null, 2)}</pre>
      </div>
    </ExampleCard>
  );
}

function DetachedContinuumRuntime({
  scenario,
  stepIndex,
  initialValues,
  previewNotice,
}: {
  scenario: PlaygroundDetachedScenario;
  stepIndex: number;
  initialValues: Record<string, NodeValue>;
  previewNotice?: JSX.Element;
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
      session.pushView(scenario.steps[index].view);
    }
  }, [boundedStepIndex, initialValues, scenario, session]);

  const currentView = snapshot?.view ?? scenario.steps[boundedStepIndex].view;
  const values = snapshot?.data.values ?? {};
  const detachedValues = snapshot?.data.detachedValues ?? {};
  const trackedFields = buildTrackedFieldStates(scenario, currentView, values);

  const status =
    boundedStepIndex === 0
      ? 'User data staged'
      : boundedStepIndex === 1
      ? `${String(
          Object.keys(detachedValues).length
        )} detached values preserved`
      : 'Detached values restored';

  return (
    <DetachedPaneCard
      title="With Continuum Reconciliation"
      description="Removed and incompatible fields detach their prior user values, then restore automatically when compatible fields return."
      status={status}
      modelDescription="Continuum preserves removed or incompatible values in detached storage and reattaches them when matching keys return in a compatible shape."
      values={values}
      trackedFields={trackedFields}
      detachedValues={detachedValues}
      previewNotice={previewNotice}
      fieldDetails={
        <>
          {trackedFields.map((field) => (
            <StateSummaryCard
              key={field.key}
              title={field.label}
              rows={[
                {
                  label: 'Status',
                  value: continuumFieldStatus(
                    scenario,
                    boundedStepIndex,
                    field,
                    detachedValues
                  ),
                },
                {
                  label: 'Current node id',
                  value: field.nodeId ?? 'Not present in this view',
                },
                {
                  label: 'Current value',
                  value: stringifyValue(field.value?.value),
                },
              ]}
            />
          ))}
        </>
      }
      preview={<ContinuumRenderer view={currentView} />}
    />
  );
}

function NaiveDetachedDetails({
  scenario,
  replay,
  stepIndex,
}: {
  scenario: PlaygroundDetachedScenario;
  replay: PlaygroundDetachedReplayState;
  stepIndex: number;
}) {
  return (
    <>
      {replay.trackedFields.map((field) => (
        <StateSummaryCard
          key={field.key}
          title={field.label}
          rows={[
            {
              label: 'Status',
              value: naiveFieldStatus(scenario, stepIndex, field),
            },
            {
              label: 'Current node id',
              value: field.nodeId ?? 'Not present in this view',
            },
            {
              label: 'Current value',
              value: stringifyValue(field.value?.value),
            },
          ]}
        />
      ))}
    </>
  );
}

export function DetachedPane({
  scenario,
  stepIndex,
  mode,
  inputValues,
}: {
  scenario: PlaygroundDetachedScenario;
  stepIndex: number;
  mode: 'naive' | 'continuum';
  inputValues: Record<string, string>;
}) {
  const initialValues = useMemo(
    () => buildSeedValues(scenario.initialValues, inputValues),
    [inputValues, scenario.initialValues]
  );
  const previewHighlights = useMemo(() => {
    if (stepIndex === 0) {
      return {};
    }

    if (stepIndex === 1) {
      return {
        'profile.notes': {
          tone: 'error',
        } as const,
      };
    }

    return Object.fromEntries(
      scenario.restoredKeys.map((key) => [
        key,
        {
          tone: 'error',
        } as const,
      ])
    );
  }, [scenario.restoredKeys, stepIndex]);
  const previewComponentMap = useMemo(
    () => createHighlightedComponentMap(previewHighlights, componentMap),
    [previewHighlights]
  );
  const previewNotice =
    mode === 'naive' && stepIndex === 1 ? (
      <div style={previewNoticeStyle}>
        Location is removed from this view and its prior value is lost on the
        naive path.
      </div>
    ) : undefined;

  if (mode === 'continuum') {
    return (
      <ContinuumProvider components={componentMap} persist={false}>
        <DetachedContinuumRuntime
          scenario={scenario}
          stepIndex={stepIndex}
          initialValues={initialValues}
          previewNotice={previewNotice}
        />
      </ContinuumProvider>
    );
  }

  const replay = replayNaiveDetachedScenario(
    scenario,
    stepIndex,
    initialValues
  );

  return (
    <DetachedPaneCard
      title="Without Continuum Reconciliation"
      description="Removed fields disappear, incompatible type changes reset the value model, and nothing is restored when compatible fields return later."
      status={replay.status}
      modelDescription="Values only survive while the current rendered node shape still holds them. There is no detached store to preserve or restore prior input."
      values={replay.values}
      trackedFields={replay.trackedFields}
      detachedValues={{}}
      fieldDetails={
        <NaiveDetachedDetails
          scenario={scenario}
          replay={replay}
          stepIndex={stepIndex}
        />
      }
      previewNotice={previewNotice}
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
