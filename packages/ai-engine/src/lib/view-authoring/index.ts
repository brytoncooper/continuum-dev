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

export type StarterKitViewAuthoringFormat = 'line-dsl' | 'yaml';

export function buildViewAuthoringSystemPrompt(args: {
  format: StarterKitViewAuthoringFormat;
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  if (args.format === 'yaml') {
    return buildViewYamlSystemPrompt({
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
  format: StarterKitViewAuthoringFormat;
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  validationErrors?: string[];
  runtimeErrors?: string[];
}): string {
  if (args.format === 'yaml') {
    return buildViewYamlUserMessage(args);
  }

  return buildViewLineDslUserMessage(args);
}

export function parseViewAuthoringToViewDefinition(args: {
  format: StarterKitViewAuthoringFormat;
  text: string;
  fallbackView?: ViewDefinition;
}): ViewDefinition | null {
  if (args.format === 'yaml') {
    return parseViewYamlToViewDefinition(args);
  }

  return parseViewLineDslToViewDefinition(args);
}
