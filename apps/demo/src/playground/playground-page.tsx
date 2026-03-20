import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { repositoryUrl } from '../site-config';
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

const coreScenario = playgroundScenariosById[defaultPlaygroundScenarioId];
const advancedScenarios = playgroundScenarios.filter(
  (scenario) => scenario.id !== defaultPlaygroundScenarioId
);

const sectionWrapStyle: CSSProperties = {
  width: '100%',
  maxWidth: page.width,
  display: 'grid',
  gap: space.lg,
};

const helperBarStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
};

const helperButtonStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  border: `1px solid ${color.border}`,
  background: color.surface,
  borderRadius: radius.pill,
  padding: `${space.sm}px ${space.md}px`,
  cursor: 'pointer',
  textAlign: 'left',
};

const helperPanelStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  border: `1px solid ${color.border}`,
  background: color.surfaceInset,
  borderRadius: radius.lg,
  padding: space.lg,
};

const stepListStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
};

const stepItemStyle = (active: boolean): CSSProperties => ({
  border: `1px solid ${active ? color.accentStrong : color.border}`,
  background: active ? color.surfaceAccent : color.surface,
  borderRadius: radius.md,
  padding: `${space.sm}px ${space.md}px`,
  display: 'grid',
  gap: space.xs,
});

const stepTitleStyle: CSSProperties = {
  ...type.small,
  color: color.text,
};

const stepDescriptionStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const primaryLinkStyle: CSSProperties = {
  ...type.small,
  color: color.surface,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.accentStrong}`,
  background: color.accent,
};

const secondaryLinkStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

type SupportPanel = 'none' | 'learn' | 'resources';

export function PlaygroundPage() {
  const [scenarioId, setScenarioId] = useState(defaultPlaygroundScenarioId);
  const [supportPanel, setSupportPanel] = useState<SupportPanel>('none');
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
    setSupportPanel('none');
  }, [scenario]);

  const stepTitles = useMemo(
    () => scenario.steps.map((step) => step.title),
    [scenario.steps]
  );
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  const inputValues = scenarioInputs[scenario.id] ?? getScenarioDefaultInputValues(scenario);
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
  const currentStep = scenario.steps[boundedStepIndex];

  const toggleSupportPanel = (panel: Exclude<SupportPanel, 'none'>) => {
    setSupportPanel((current) => (current === panel ? 'none' : panel));
  };

  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow={playgroundContent.eyebrow}
      title={playgroundContent.title}
      description={playgroundContent.description}
    >
      <PageSection
        title={scenario.title}
        description={currentStep.description}
      >
        <div style={sectionWrapStyle}>
          <ScenarioSelector
            coreScenario={coreScenario}
            advancedScenarios={advancedScenarios}
            activeScenarioId={scenario.id}
            onSelect={setScenarioId}
          />
          <ScenarioControls
            inputTitle={scenario.controls.inputLabel ?? 'Your input'}
            inputDescription={
              scenario.controls.inputDescription ??
              'This value will be used in both panes.'
            }
            inputFields={inputFields}
            stepIndex={boundedStepIndex}
            onStepChange={setStepIndex}
            stepTitles={stepTitles}
            stepDescription={currentStep.description}
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
          <div style={helperBarStyle}>
            <button
              type="button"
              style={helperButtonStyle}
              onClick={() => toggleSupportPanel('learn')}
            >
              {supportPanel === 'learn' ? 'Hide context' : 'Why this scenario matters'}
            </button>
            <button
              type="button"
              style={helperButtonStyle}
              onClick={() => toggleSupportPanel('resources')}
            >
              {supportPanel === 'resources' ? 'Hide links' : 'Open docs and links'}
            </button>
            <button
              type="button"
              style={helperButtonStyle}
              onClick={() => setStepIndex(0)}
            >
              Restart from step 1
            </button>
          </div>
          {supportPanel === 'learn' ? (
            <div style={helperPanelStyle}>
              <PlaygroundStepCard
                title="Scenario context"
                description={scenario.problem}
                whyItMatters={scenario.whyItMatters}
              />
              <div style={stepListStyle}>
                {scenario.steps.map((step, index) => (
                  <div key={step.title} style={stepItemStyle(index === boundedStepIndex)}>
                    <div style={stepTitleStyle}>{`Step ${index + 1}: ${step.title}`}</div>
                    <div style={stepDescriptionStyle}>{step.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {supportPanel === 'resources' ? (
            <div style={helperPanelStyle}>
              <div style={linkRowStyle}>
                <a href={repositoryUrl} target="_blank" rel="noreferrer" style={primaryLinkStyle}>
                  View Continuum on GitHub
                </a>
                <a href="/docs" style={secondaryLinkStyle}>
                  Read setup docs
                </a>
                <a href="/starter-kit" style={secondaryLinkStyle}>
                  Explore Starter Kit
                </a>
                <a href="/live-ai" style={secondaryLinkStyle}>
                  Open Live AI Demo
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </PageSection>
    </PageShell>
  );
}
