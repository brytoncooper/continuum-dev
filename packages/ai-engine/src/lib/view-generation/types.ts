import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type { StarterKitSessionAdapter } from '../session/index.js';
import type { StarterKitViewAuthoringFormat } from '../view-authoring/index.js';

export interface StarterKitRunViewGenerationArgs {
  provider: AiConnectClient;
  session: StarterKitSessionAdapter;
  instruction: string;
  mode: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: StarterKitViewAuthoringFormat;
  autoApplyView?: boolean;
}

export interface StarterKitRunViewGenerationResult {
  result: AiConnectGenerateResult;
  parsed: unknown;
  status: string;
}
