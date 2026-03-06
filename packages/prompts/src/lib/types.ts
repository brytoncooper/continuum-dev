export type PromptMode = 'create-view' | 'evolve-view' | 'correction-loop';

export type PromptAddon = 'attachments' | 'strict-continuity';

export interface PromptLibrary {
  version: string;
  base: string;
  modes: Record<PromptMode, string>;
  addons: Record<PromptAddon, string>;
}

export interface AssembleSystemPromptArgs {
  mode: PromptMode;
  addons?: PromptAddon[];
}

export interface BuildUserMessageArgs {
  currentView?: unknown;
  instruction: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
  detachedNodeIds?: string[];
}
