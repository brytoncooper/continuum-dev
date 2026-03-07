import type { PlaygroundScenario } from '../types';
import { collectionEvolutionScenario } from './collection-evolution';
import { compoundStructureConflictScenario } from './compound-structure-conflict';
import { conflictProposalsScenario } from './conflict-proposals';
import { detachedRestoreScenario } from './detached-restore';
import { rewindRecoveryScenario } from './rewind-recovery';
import { simpleStateDropScenario } from './simple-state-drop';

export const playgroundScenarios: PlaygroundScenario[] = [
  simpleStateDropScenario,
  conflictProposalsScenario,
  detachedRestoreScenario,
  collectionEvolutionScenario,
  compoundStructureConflictScenario,
  rewindRecoveryScenario,
];

export const defaultPlaygroundScenarioId = simpleStateDropScenario.id;

export const playgroundScenariosById = Object.fromEntries(
  playgroundScenarios.map((scenario) => [scenario.id, scenario])
) as Record<string, PlaygroundScenario>;
