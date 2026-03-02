import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ViewDefinition } from '@continuum/contract';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
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

const defaultScenarioId = scenarios[0]?.id ?? '';

const sessionOptions: SessionOptions = {
  reconciliation: {
    strategyRegistry: {
      'email-v1-to-v2': (_nodeId, _priorNode, _newNode, priorValue) => priorValue,
      'date-v1-to-v2': (_nodeId, _priorNode, _newNode, priorValue) => priorValue,
    },
  },
  validateOnUpdate: true,
};

interface PlaygroundContentProps {
  onBackToIntro: () => void;
  routeScenarioId: string;
  onScenarioRouteChange: (scenarioId: string) => void;
}

function PlaygroundContent({
  onBackToIntro,
  routeScenarioId,
  onScenarioRouteChange,
}: PlaygroundContentProps) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { issues, diffs, resolutions, checkpoints } = useContinuumDiagnostics();
  const wasHydrated = useContinuumHydrated();

  const [selectedScenarioId, setSelectedScenarioId] = useState(routeScenarioId);
  const [stepIndex, setStepIndex] = useState(-1);
  const [protocolMode, setProtocolMode] = useState<ProtocolMode>('native');
  const initializedRef = useRef(false);
  const scenarioEffectReadyRef = useRef(false);

  useEffect(() => {
    if (routeScenarioId === selectedScenarioId) {
      return;
    }
    session.reset();
    setSelectedScenarioId(routeScenarioId);
    setProtocolMode('native');
    setStepIndex(0);
  }, [routeScenarioId, selectedScenarioId, session]);

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
      session.pushView(step.view as ViewDefinition);
      if (step.initialState && clamped === 0) {
        const existingValues = session.getSnapshot()?.data.values ?? {};
        for (const [nodeId, value] of Object.entries(step.initialState)) {
          if (existingValues[nodeId] === undefined) {
            session.updateState(nodeId, value);
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
    const index = activeSteps.findIndex((step) => step.view.version === existing.view.version);
    if (index >= 0) {
      setStepIndex(index);
      return;
    }
    pushStep(activeSteps.length - 1);
  }, [activeSteps, pushStep, session]);

  const handleScenarioSelect = useCallback(
    (scenarioId: string) => {
      if (scenarioId === selectedScenarioId) {
        return;
      }
      onScenarioRouteChange(scenarioId);
    },
    [onScenarioRouteChange, selectedScenarioId]
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
        (step) => step.view.version === updatedSnapshot.view.version
      );
      setStepIndex(matchedIndex);
    },
    [activeSteps, session]
  );

  const handleHallucinate = useCallback(() => {
    const activeView = session.getSnapshot()?.view;
    if (!activeView) {
      return;
    }
    session.pushView(hallucinate(activeView));
  }, [session]);

  const currentStep = activeSteps[Math.max(0, stepIndex)] ?? null;
  const detachedValues = snapshot?.data.detachedValues ?? {};
  if (!selectedScenario) {
    return null;
  }
  if (!currentStep && !wasHydrated) {
    return null;
  }

  return (
    <>
      <TraceAnimations resolutions={resolutions} />
      <ReconciliationToast resolutions={resolutions} />
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
              protocolMode === 'a2ui' ? 'Adapter-generated view walkthrough' : selectedScenario.subtitle
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
                resolutions={resolutions}
                diffs={diffs}
                detachedValues={detachedValues}
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
              <ValueCallout hint={currentStep?.outcomeHint} resolutions={resolutions} diffs={diffs} />
            }
            renderedUi={
              snapshot?.view ? (
                <ContinuumRenderer view={snapshot.view} />
              ) : (
                <div>No view loaded</div>
              )
            }
          />
        }
      />
    </>
  );
}

function LandingRoute() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);

  const handleEnterPlayground = useCallback(() => {
    setExiting(true);
    window.setTimeout(() => {
      navigate('/playground');
    }, 600);
  }, [navigate]);

  return (
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
  );
}

function PlaygroundRoute() {
  const navigate = useNavigate();
  const { scenarioId } = useParams<{ scenarioId: string }>();

  if (!defaultScenarioId) {
    return null;
  }

  if (!scenarioId) {
    return <Navigate to={`/playground/${defaultScenarioId}`} replace />;
  }

  const validScenario = scenarios.some((scenario) => scenario.id === scenarioId);
  if (!validScenario) {
    return <Navigate to={`/playground/${defaultScenarioId}`} replace />;
  }

  return (
    <ContinuumProvider
      components={componentMap}
      persist="localStorage"
      sessionOptions={sessionOptions}
    >
      <PlaygroundContent
        onBackToIntro={() => navigate('/')}
        routeScenarioId={scenarioId}
        onScenarioRouteChange={(nextScenarioId) => navigate(`/playground/${nextScenarioId}`)}
      />
    </ContinuumProvider>
  );
}

export default function App() {
  return (
    <>
      <style>{globalStyles}</style>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route
          path="/playground"
          element={
            defaultScenarioId ? (
              <Navigate to={`/playground/${defaultScenarioId}`} replace />
            ) : (
              <LandingRoute />
            )
          }
        />
        <Route path="/playground/:scenarioId" element={<PlaygroundRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
