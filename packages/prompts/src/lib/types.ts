export type PromptMode = 'create-view' | 'evolve-view' | 'correction-loop';

export type PromptAddon = 'attachments' | 'strict-continuity';

export type JsonSchema = Record<string, unknown>;

export interface PromptOutputContract {
  name: string;
  schema: JsonSchema;
  strict?: boolean;
}

export interface PromptLibrary {
  version: string;
  base: string;
  modes: Record<PromptMode, string>;
  addons: Record<PromptAddon, string>;
  outputContract: PromptOutputContract;
}

export interface AssembleSystemPromptArgs {
  mode: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
}

export interface BuildUserMessageArgs {
  currentView?: unknown;
  instruction: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
  detachedNodeIds?: string[];
}
