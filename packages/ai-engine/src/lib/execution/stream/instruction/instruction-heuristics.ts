import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptMode } from '@continuum-dev/prompts';

export function looksLikeStructuralEditInstruction(instruction: string): boolean {
  const t = instruction.trim().toLowerCase();
  return /\b(add|remove|move|delete|more|fewer|less|short|shorter|reorder|layout|row|column|section|field|label|insert|wrap)\b/.test(
    t
  );
}

export function inferPromptMode(
  requestedMode: PromptMode | undefined,
  currentView: ViewDefinition | undefined
): PromptMode {
  if (requestedMode) {
    return requestedMode;
  }

  return currentView?.nodes.length ? 'evolve-view' : 'create-view';
}
