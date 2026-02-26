import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SchemaSnapshot } from '@continuum/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumDiagnostics,
  useContinuumHydrated,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum/react';
import { hallucinate } from './chaos';
import { componentMap } from './component-map';
import { scenarios } from './scenarios/registry';
import type { ScenarioStep } from './scenarios/types';
import { StoryHeader } from './ui/controls/StoryHeader';
import { RewindTimeline } from './ui/controls/RewindTimeline';
import { StepControls } from './ui/controls/StepControls';
import { CollapsiblePanel } from './ui/devtools/CollapsiblePanel';
import { DiffList } from './ui/devtools/DiffList';
import { IssuesList } from './ui/devtools/IssuesList';
import { IssuesSummary } from './ui/devtools/IssuesSummary';
import { SnapshotViewer } from './ui/devtools/SnapshotViewer';
import { TraceList } from './ui/devtools/TraceList';
import { globalStyles } from './ui/global-styles';
import { ReconciliationToast } from './ui/feedback/ReconciliationToast';
import { RefreshBanner } from './ui/feedback/RefreshBanner';
import { TraceAnimations } from './ui/feedback/TraceAnimations';
import { ValueCallout } from './ui/feedback/ValueCallout';
import { AppShell } from './ui/layout/AppShell';
import { DevtoolsDock } from './ui/layout/DevtoolsDock';
import { MainStage } from './ui/layout/MainStage';

type ProtocolMode = 'native' | 'a2ui';

function PlaygroundContent() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { issues, diffs, trace, checkpoints } = useContinuumDiagnostics();
  const wasHydrated = useContinuumHydrated();

  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? '');
  const [stepIndex, setStepIndex] = useState(-1);
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('native');
  const initializedRef = useRef(false);
  const scenarioEffectReadyRef = useRef(false);

  const selectedScenario = useMemo(() => {
    return scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  }, [selectedScenarioId]);

  const activeSteps = useMemo<ScenarioStep[]>(() => {
    if (!selectedScenario) {
      return [];
    }
    return selectedScenario.steps;
  }, [selectedScenario]);

  const pushStep = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(activeSteps.length - 1, index));
      const step = activeSteps[clamped];
      if (!step) {
        return;
      }
      session.pushSchema(step.schema as SchemaSnapshot);
      if (step.initialState && clamped === 0) {
        const existingValues = session.getSnapshot()?.state.values ?? {};
        for (const [componentId, value] of Object.entries(step.initialState)) {
          if (existingValues[componentId] === undefined) {
            session.updateState(componentId, value);
          }
        }
      }
      setStepIndex(clamped);
    },
    [activeSteps, session]
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;
    const existing = session.getSnapshot();
    if (!existing) {
      pushStep(0);
      return;
    }
    const index = activeSteps.findIndex((step) => step.schema.version === existing.schema.version);
    if (index >= 0) {
      setStepIndex(index);
      return;
    }
    pushStep(activeSteps.length - 1);
  }, [activeSteps, pushStep, session]);

  const handleScenarioSelect = useCallback(
    (scenarioId: string) => {
      session.reset();
      setSelectedScenarioId(scenarioId);
      setProtocolMode('native');
      setStepIndex(0);
    },
    [session]
  );

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    if (!scenarioEffectReadyRef.current) {
      scenarioEffectReadyRef.current = true;
      return;
    }
    pushStep(0);
  }, [selectedScenarioId, protocolMode, pushStep]);

  const handleRewind = useCallback(
    (checkpointId: string) => {
      session.rewind(checkpointId);
      const updatedSnapshot = session.getSnapshot();
      if (!updatedSnapshot) {
        setStepIndex(-1);
        return;
      }
      const matchedIndex = activeSteps.findIndex(
        (step) => step.schema.version === updatedSnapshot.schema.version
      );
      setStepIndex(matchedIndex);
    },
    [activeSteps, session]
  );

  const handleHallucinate = useCallback(() => {
    const activeSchema = session.getSnapshot()?.schema;
    if (!activeSchema) {
      return;
    }
    session.pushSchema(hallucinate(activeSchema));
  }, [session]);

  const currentStep = activeSteps[Math.max(0, stepIndex)] ?? null;
  if (!selectedScenario) {
    return null;
  }
  if (!currentStep && !wasHydrated) {
    return null;
  }

  return (
    <>
      <style>{globalStyles}</style>
      <TraceAnimations trace={trace} />
      <ReconciliationToast trace={trace} />
      <AppShell
        devtoolsOpen={devtoolsOpen}
        onToggleDevtools={() => setDevtoolsOpen((open) => !open)}
        header={
          <StoryHeader
            scenarios={scenarios}
            activeScenarioId={selectedScenario.id}
            activeScenarioTitle={
              protocolMode === 'a2ui' ? 'A2UI Protocol Mode' : selectedScenario.title
            }
            activeScenarioSubtitle={
              protocolMode === 'a2ui' ? 'Adapter-generated schema walkthrough' : selectedScenario.subtitle
            }
            protocolMode={protocolMode}
            onScenarioSelect={handleScenarioSelect}
            onProtocolChange={setProtocolMode}
          />
        }
        main={
          <MainStage
            banner={<RefreshBanner wasRehydrated={wasHydrated} />}
            controls={
              <StepControls
                stepIndex={Math.max(stepIndex, 0)}
                totalSteps={activeSteps.length}
                activeStepLabel={currentStep?.label ?? 'Step 1'}
                stepProgress={`${Math.max(stepIndex + 1, 1)} of ${activeSteps.length}`}
                description={currentStep?.description ?? ''}
                narrativePrompt={currentStep?.narrativePrompt ?? ''}
                onPrev={() => pushStep(stepIndex - 1)}
                onNext={() => pushStep(stepIndex + 1)}
                onHallucinate={handleHallucinate}
              />
            }
            rewind={<RewindTimeline checkpoints={checkpoints} onRewind={handleRewind} />}
            valueCallout={
              <ValueCallout hint={currentStep?.outcomeHint} trace={trace} diffs={diffs} />
            }
            renderedUi={
              snapshot?.schema ? (
                <ContinuumRenderer schema={snapshot.schema} />
              ) : (
                <div>No schema loaded</div>
              )
            }
          />
        }
        devtools={
          <DevtoolsDock
            summary={<IssuesSummary issues={issues} />}
            tracePanel={
              <CollapsiblePanel
                title="Reconciliation Trace"
                count={trace.length}
                testId="panel-trace"
                defaultOpen={trace.some((entry) => entry.action === 'dropped' || entry.action === 'migrated')}
              >
                <TraceList trace={trace} />
              </CollapsiblePanel>
            }
            diffPanel={
              <CollapsiblePanel
                title="Diffs"
                count={diffs.length}
                testId="panel-diffs"
                defaultOpen={diffs.length > 0}
              >
                <DiffList diffs={diffs} />
              </CollapsiblePanel>
            }
            issuesPanel={
              <CollapsiblePanel
                title="Issues"
                count={issues.length}
                testId="panel-issues"
                defaultOpen={issues.some((issue) => issue.severity === 'error' || issue.severity === 'warning')}
              >
                <IssuesList issues={issues} />
              </CollapsiblePanel>
            }
            snapshotPanel={
              <CollapsiblePanel title="Snapshot" testId="panel-snapshot">
                <SnapshotViewer snapshot={snapshot} />
              </CollapsiblePanel>
            }
          />
        }
      />
    </>
  );
}

export default function App() {
  return (
    <ContinuumProvider components={componentMap} persist="localStorage">
      <PlaygroundContent />
    </ContinuumProvider>
  );
}
