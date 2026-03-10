import type { ViewDefinition } from '@continuum-dev/core';
import type { PromptAddon, PromptMode } from '@continuum-dev/prompts';
import {
  buildClaudeViewDslSystemPrompt,
  buildClaudeViewDslUserMessage,
  parseClaudeViewDslToViewDefinition,
} from './claude-view-dsl.js';
import {
  buildViewYamlSystemPrompt,
  buildViewYamlUserMessage,
  parseViewYamlToViewDefinition,
} from './view-yaml.js';

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

  return buildClaudeViewDslSystemPrompt({
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

  return buildClaudeViewDslUserMessage(args);
}

export function parseViewAuthoringToViewDefinition(args: {
  format: StarterKitViewAuthoringFormat;
  text: string;
  fallbackView?: ViewDefinition;
}): ViewDefinition | null {
  if (args.format === 'yaml') {
    return parseViewYamlToViewDefinition(args);
  }

  return parseClaudeViewDslToViewDefinition(args);
}
