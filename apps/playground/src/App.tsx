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
import type { SessionOptions } from '@continuum/session';
import { hallucinate } from './chaos';
import { componentMap } from './component-map';
import { scenarios } from './scenarios/registry';
import type { ScenarioStep } from './scenarios/types';
import { LandingPage } from './ui/landing/LandingPage';
import { ScenarioContextCard } from './ui/controls/ScenarioContextCard';
import { StoryHeader } from './ui/controls/StoryHeader';
import { DevtoolsTabs } from './ui/devtools/DevtoolsTabs';
import { globalStyles } from './ui/global-styles';
import { ReconciliationToast } from './ui/feedback/ReconciliationToast';
import { RefreshBanner } from './ui/feedback/RefreshBanner';
import { TraceAnimations } from './ui/feedback/TraceAnimations';
import { ValueCallout } from './ui/feedback/ValueCallout';
import { AppShell } from './ui/layout/AppShell';
import { MainStage } from './ui/layout/MainStage';

type ProtocolMode = 'native' | 'a2ui';

interface PlaygroundContentProps {
  onBackToIntro: () => void;
}

function PlaygroundContent({ onBackToIntro }: PlaygroundContentProps) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { issues, diffs, trace, checkpoints } = useContinuumDiagnostics();
  const wasHydrated = useContinuumHydrated();

  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? '');
  const [stepIndex, setStepIndex] = useState(-1);
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
  const orphanedValues = snapshot?.state.orphanedValues ?? {};
  if (!selectedScenario) {
    return null;
  }
  if (!currentStep && !wasHydrated) {
    return null;
  }

  return (
    <>
      <TraceAnimations trace={trace} />
      <ReconciliationToast trace={trace} />
      <AppShell
        header={
          <StoryHeader
            onBackToIntro={onBackToIntro}
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
            devtools={
              <DevtoolsTabs
                trace={trace}
                diffs={diffs}
                orphanedValues={orphanedValues}
                issues={issues}
                snapshot={snapshot}
              />
            }
            controls={
              <ScenarioContextCard
                stepIndex={Math.max(stepIndex, 0)}
                totalSteps={activeSteps.length}
                activeStepLabel={currentStep?.label ?? 'Step 1'}
                description={currentStep?.description ?? ''}
                narrativePrompt={currentStep?.narrativePrompt ?? ''}
                checkpoints={checkpoints}
                onPrev={() => pushStep(stepIndex - 1)}
                onNext={() => pushStep(stepIndex + 1)}
                onRewind={handleRewind}
                onHallucinate={handleHallucinate}
              />
            }
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
      />
    </>
  );
}

export default function App() {
  const [showPlayground, setShowPlayground] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleEnterPlayground = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setShowPlayground(true);
      setExiting(false);
    }, 600);
  }, []);

  const sessionOptions: SessionOptions = {
    reconciliation: {
      strategyRegistry: {
        'email-v1-to-v2': (_componentId, _oldSchema, _newSchema, oldState) => oldState,
        'date-v1-to-v2': (_componentId, _oldSchema, _newSchema, oldState) => oldState,
      },
    },
    validateOnUpdate: true,
  };

  if (!showPlayground) {
    return (
      <>
        <style>{globalStyles}</style>
        <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateY(-40px)' : 'translateY(0)',
        }}
      >
        <LandingPage onEnter={handleEnterPlayground} />
      </div>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>
      <ContinuumProvider
      components={componentMap}
      persist="localStorage"
      sessionOptions={sessionOptions}
    >
      <PlaygroundContent onBackToIntro={() => setShowPlayground(false)} />
    </ContinuumProvider>
    </>
  );
}
