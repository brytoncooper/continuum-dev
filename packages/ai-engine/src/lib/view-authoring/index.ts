import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';
import {
  buildViewLineDslSystemPrompt,
  buildViewLineDslUserMessage,
  parseViewLineDslToViewDefinition,
} from './line-dsl/index.js';
import {
  buildViewYamlSystemPrompt,
  buildViewYamlUserMessage,
  parseViewYamlToViewDefinition,
} from './yaml/index.js';
import {
  buildViewJsonSystemPrompt,
  buildViewJsonUserMessage,
} from './view-json/prompt.js';
import { parseViewJsonToViewDefinition } from './view-json/parse.js';

export {
  buildViewLineDslSystemPrompt,
  buildViewLineDslUserMessage,
  parseViewLineDslToViewDefinition,
};
export {
  buildViewYamlSystemPrompt,
  buildViewYamlUserMessage,
  parseViewYamlToViewDefinition,
};
export {
  buildViewJsonSystemPrompt,
  buildViewJsonUserMessage,
  parseViewJsonToViewDefinition,
};

/**
 * How the model should author views: compact line DSL, fenced YAML, or structured
 * JSON (`view-json`) aligned with `VIEW_DEFINITION_OUTPUT_CONTRACT`.
 */
export type ContinuumViewAuthoringFormat = 'line-dsl' | 'yaml' | 'view-json';

export function buildViewAuthoringSystemPrompt(args: {
  format: ContinuumViewAuthoringFormat;
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  if (args.format === 'yaml') {
    return buildViewYamlSystemPrompt({
      mode: args.mode,
      addons: args.addons,
    });
  }

  if (args.format === 'view-json') {
    return buildViewJsonSystemPrompt({
      mode: args.mode,
      addons: args.addons,
    });
  }

  return buildViewLineDslSystemPrompt({
    mode: args.mode,
    addons: args.addons,
  });
}

export function buildViewAuthoringUserMessage(args: {
  format: ContinuumViewAuthoringFormat;
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  conversationSummary?: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
  integrationBinding?: string;
}): string {
  if (args.format === 'yaml') {
    return buildViewYamlUserMessage(args);
  }

  if (args.format === 'view-json') {
    return buildViewJsonUserMessage(args);
  }

  return buildViewLineDslUserMessage(args);
}

/**
 * Parses model output into a `ViewDefinition`. For `view-json`, pass `json` when
 * the execution adapter returned structured data (e.g. provider JSON mode).
 */
export function parseViewAuthoringToViewDefinition(args: {
  format: ContinuumViewAuthoringFormat;
  text: string;
  json?: unknown | null;
  fallbackView?: ViewDefinition;
}): ViewDefinition | null {
  if (args.format === 'yaml') {
    return parseViewYamlToViewDefinition({
      text: args.text,
      fallbackView: args.fallbackView,
    });
  }

  if (args.format === 'view-json') {
    return parseViewJsonToViewDefinition({
      text: args.text,
      json: args.json,
    });
  }

  return parseViewLineDslToViewDefinition({
    text: args.text,
    fallbackView: args.fallbackView,
  });
}
