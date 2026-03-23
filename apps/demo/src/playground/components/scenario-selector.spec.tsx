import { renderToStaticMarkup } from 'react-dom/server';
import { playgroundScenarios } from '../scenarios';
import { ScenarioSelector } from './scenario-selector';

describe('ScenarioSelector', () => {
  it('keeps the core proof path obvious and advanced scenarios secondary', () => {
    const [coreScenario, ...advancedScenarios] = playgroundScenarios;
    const html = renderToStaticMarkup(
      <ScenarioSelector
        coreScenario={coreScenario}
        advancedScenarios={advancedScenarios}
        activeScenarioId={coreScenario.id}
        onSelect={() => undefined}
      />
    );

    expect(html).toContain(coreScenario.selectorLabel);
    expect(html).toContain('Try advanced scenarios');
    expect(html).toContain(advancedScenarios[0]?.selectorLabel ?? '');
    expect(html).not.toContain('Queued after these');
  });
});
