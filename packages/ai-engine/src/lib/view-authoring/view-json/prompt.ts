import {
  type PromptAddon,
  type PromptMode,
  assembleSystemPrompt,
  VIEW_DEFINITION_OUTPUT_CONTRACT,
} from '@continuum-dev/prompts';
import { buildViewJsonAuthoringExtension } from '../shared/continuum-view-authoring-guidance.js';

/**
 * System prompt for structured JSON view authoring (same contract as
 * `VIEW_DEFINITION_OUTPUT_CONTRACT`), via `assembleSystemPrompt`, plus shared
 * Continuum layout and continuity guidance aligned with line-dsl and yaml.
 */
export function buildViewJsonSystemPrompt(args: {
  mode: PromptMode;
  addons?: PromptAddon[];
}): string {
  const core = assembleSystemPrompt({
    mode: args.mode,
    addons: args.addons,
    outputContract: VIEW_DEFINITION_OUTPUT_CONTRACT,
    includeOutputContractInstructions: true,
  });
  return `${core}\n\nThis is full view authoring. Do not return state updates, patch operations, or transform plans.\n\n${buildViewJsonAuthoringExtension(args)}`;
}

/**
 * User message for structured JSON view authoring; context matches line-dsl/yaml.
 */
export function buildViewJsonUserMessage(args: {
  mode: PromptMode;
  instruction: string;
  currentView?: unknown;
  detachedFields?: unknown[];
  conversationSummary?: string;
  validationErrors?: string[];
  runtimeErrors?: string[];
  integrationBinding?: string;
}): string {
  const sections = ['<input>'];

  const integrationBindingText =
    typeof args.integrationBinding === 'string'
      ? args.integrationBinding.trim()
      : '';

  sections.push(
    'Continuum context:\n' +
      '- The current view represents the live browser UI the user is working on.\n' +
      '- Your response becomes the next version of that UI.\n' +
      '- Keep the current workflow stable unless the instruction clearly asks for broader change.\n' +
      '- This is the full-view authoring lane. Do not answer with state updates, patch operations, or transform plans.' +
      (integrationBindingText.length > 0
        ? '\n- A backend integration contract is included below: every persisted field semantic key must stay within that single endpoint schema.'
        : '')
  );

  if (typeof args.currentView !== 'undefined') {
    sections.push(
      `Current view:\n${JSON.stringify(args.currentView, null, 2)}`
    );
  }

  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):\n' +
        args.conversationSummary.trim()
    );
  }

  if (Array.isArray(args.detachedFields)) {
    sections.push(
      'Detached fields are prior removed fields available for runtime continuity only. Do not use previousLabel or previousParentLabel to infer restore targets.\n' +
        `Detached fields:\n${
          args.detachedFields.length > 0
            ? JSON.stringify(args.detachedFields, null, 2)
            : 'none'
        }`
    );
  }

  if (
    args.mode === 'correction-loop' &&
    Array.isArray(args.validationErrors) &&
    Array.isArray(args.runtimeErrors)
  ) {
    sections.push(
      `Validation errors:\n${
        args.validationErrors.length > 0
          ? args.validationErrors.join('\n')
          : 'none'
      }`
    );
    sections.push(
      `Runtime errors:\n${
        args.runtimeErrors.length > 0 ? args.runtimeErrors.join('\n') : 'none'
      }`
    );
  }

  if (integrationBindingText.length > 0) {
    sections.push(integrationBindingText);
  }

  sections.push(`Instruction:\n${args.instruction.trim()}`);
  sections.push(
    'Output format:\nReturn only JSON that matches the output contract (viewId, version, nodes). No markdown fences, no commentary outside the JSON object.'
  );
  sections.push('</input>');

  return sections.join('\n\n');
}
