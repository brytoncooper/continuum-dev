import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { color, page, radius, space, type } from '../ui/tokens';
import { SiteNav } from '../ui/site-nav';
import { playgroundContent } from './content/playground-content';
import { CollectionPane } from './components/collection-pane';
import { ConflictPane } from './components/conflict-pane';
import { DetachedPane } from './components/detached-pane';
import { ContinuityPane } from './components/continuity-pane';
import { NaivePane } from './components/naive-pane';
import { PlaygroundStepCard } from './components/playground-step-card';
import { RecoveryPane } from './components/recovery-pane';
import { ScenarioControls } from './components/scenario-controls';
import { ScenarioSelector } from './components/scenario-selector';
import {
  getScenarioDefaultInputValues,
  getScenarioInputFields,
} from './state/scenario-inputs';
import {
  defaultPlaygroundScenarioId,
  playgroundScenarios,
  playgroundScenariosById,
} from './scenarios';

const scenarioLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: space.lg,
  alignItems: 'start',
};

const scenarioMainStyle: CSSProperties = {
  display: 'grid',
  gap: space.lg,
  minWidth: 0,
};

const stickyRailStyle: CSSProperties = {
  position: 'sticky',
  top: space.xxxl,
  alignSelf: 'start',
};

const responsiveLayoutStyle: CSSProperties = {
  width: '100%',
  maxWidth: page.width,
};

const liveAiCalloutStyle: CSSProperties = {
  marginTop: space.md,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.md,
  flexWrap: 'wrap',
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surfaceMuted,
};

const liveAiLinkStyle: CSSProperties = {
  ...type.small,
  color: color.surface,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderStrong}`,
  background: color.accent,
};

export function PlaygroundPage() {
  const [scenarioId, setScenarioId] = useState(defaultPlaygroundScenarioId);
  const [scenarioInputs, setScenarioInputs] = useState<
    Record<string, Record<string, string>>
  >(
    Object.fromEntries(
      playgroundScenarios.map((scenario) => [
        scenario.id,
        getScenarioDefaultInputValues(scenario),
      ])
    )
  );
  const [stepIndex, setStepIndex] = useState(0);
  const scenario = playgroundScenariosById[scenarioId];

  useEffect(() => {
    setStepIndex(0);
  }, [scenario]);

  const stepTitles = useMemo(
    () => scenario.steps.map((step) => step.title),
    [scenario.steps]
  );
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  const inputValues =
    scenarioInputs[scenario.id] ?? getScenarioDefaultInputValues(scenario);
  const inputFields = getScenarioInputFields(scenario).map((field) => ({
    ...field,
    value: inputValues[field.key] ?? '',
    onChange: (value: string) => {
      setScenarioInputs((current) => ({
        ...current,
        [scenario.id]: {
          ...(current[scenario.id] ?? {}),
          [field.key]: value,
        },
      }));
    },
  }));
  const stateDropValue =
    scenario.kind === 'state-drop'
      ? inputValues[scenario.trackedField.key] ?? ''
      : '';

  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow={playgroundContent.eyebrow}
      title={playgroundContent.title}
      description={playgroundContent.description}
    >
      <PageSection
        title="Choose a deterministic scenario"
        description="Switch scenarios here so you can compare any available problem without scrolling past the current example."
      >
        <ScenarioSelector
          scenarios={playgroundScenarios}
          activeScenarioId={scenario.id}
          onSelect={setScenarioId}
          queuedScenarios={[...playgroundContent.queuedScenarios]}
        />
        <div style={liveAiCalloutStyle}>
          <div style={{ ...type.small, color: color.text }}>
            Want the fastest real-world starter-kit demo (with provider key)? Try Live AI Demo.
          </div>
          <a href="/live-ai" style={liveAiLinkStyle}>
            Open Live AI Demo
          </a>
        </div>
      </PageSection>
      <PageSection title={scenario.title} description={scenario.problem}>
        <div style={{ ...scenarioLayoutStyle, ...responsiveLayoutStyle }}>
          <div style={scenarioMainStyle}>
            <ScenarioControls
              inputTitle={
                scenario.controls.inputLabel ?? 'Starting form values'
              }
              inputDescription={
                scenario.controls.inputDescription ??
                'Edit these values to seed both panes before the deterministic steps replay.'
              }
              inputFields={inputFields}
              stepIndex={boundedStepIndex}
              onStepChange={setStepIndex}
              stepTitles={stepTitles}
            />
            <ExampleGrid alignItems="stretch">
              {scenario.kind === 'state-drop' ? (
                <>
                  <NaivePane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    userValue={stateDropValue}
                  />
                  <ContinuityPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    userValue={stateDropValue}
                  />
                </>
              ) : scenario.kind === 'conflict-proposals' ? (
                <>
                  <ConflictPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="naive"
                    inputValues={inputValues}
                  />
                  <ConflictPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="continuum"
                    inputValues={inputValues}
                  />
                </>
              ) : scenario.kind === 'detached-restore' ? (
                <>
                  <DetachedPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="naive"
                    inputValues={inputValues}
                  />
                  <DetachedPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="continuum"
                    inputValues={inputValues}
                  />
                </>
              ) : scenario.kind === 'collection-evolution' ? (
                <>
                  <CollectionPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="naive"
                    inputValues={inputValues}
                  />
                  <CollectionPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="continuum"
                    inputValues={inputValues}
                  />
                </>
              ) : (
                <>
                  <RecoveryPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="naive"
                    inputValues={inputValues}
                  />
                  <RecoveryPane
                    scenario={scenario}
                    stepIndex={boundedStepIndex}
                    mode="continuum"
                    inputValues={inputValues}
                  />
                </>
              )}
            </ExampleGrid>
          </div>
          <div style={stickyRailStyle}>
            <PlaygroundStepCard
              title="What this scenario proves"
              description={scenario.problem}
              whyItMatters={scenario.whyItMatters}
            />
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
}
