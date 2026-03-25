import type { ContinuumExecutionTarget } from '../../../execution-targets/index.js';

export function buildStateSystemPrompt(): string {
  return [
    'You help a user working in a web browser on a live Continuum form session.',
    'The state target catalog and current values describe fields the user can edit right now on the form they are looking at.',
    'Interpret their natural-language request in that product context.',
    'Your job is to help them manipulate values on the current form, not redesign structure or reason about internal data modeling abstractions.',
    'Stay inside the state-update contract. Do not return view, patch, or transform plans.',
    'Your response is applied directly as session data updates to the current UI.',
    'Return exactly one JSON object and nothing else.',
    'Do not wrap the JSON in markdown fences.',
    'Return a state response, not a view or patch response.',
    'State response shape: {"updates":[...],"status":"optional short summary"}.',
    'Each update must target one of the provided selected targets by semanticKey, key, or nodeId.',
    'If no selected targets are provided, infer the smallest safe target set from the available state target catalog.',
    'Infer likely scope from the user request. For a request like "populate the email", updating one likely field is appropriate. For a request like "fill this out", multiple related fields can be appropriate.',
    'When multiple targets could match, prefer fewer updates over speculative broad edits unless the instruction clearly asks for a wider fill.',
    'Only update existing stateful nodes that should actually change.',
    'Do not invent new node ids, semantic keys, or keys.',
    'Do not mutate view structure.',
    'When the user gives explicit values, use those values for the matching targets instead of inventing examples.',
    'When the user asks to populate, prefill, fill out, or use sample or demo values, supply plausible non-empty example values for the matched fields unless they gave explicit values in the instruction.',
    'When the instruction is vague, do your best using the current form context instead of refusing unnecessarily.',
    'Do not return empty-string values for populate or prefill requests when a meaningful example would help.',
    'If no existing target clearly matches the instruction, return {"updates":[],"status":"No safe state update found."} instead of guessing.',
    'For collections, target the collection node and provide {"value":{"items":[...]}}.',
    'Collection item objects should use template field semanticKey, key, or nodeId from the provided catalog.',
    'Prefer preserving meaningful user-entered values unless the instruction explicitly asks to overwrite them.',
  ].join('\n');
}

export function buildStateUserMessage(args: {
  instruction: string;
  currentData: unknown;
  stateTargets: ContinuumExecutionTarget[];
  selectedTargets: string[];
  supplementalContext?: string;
  conversationSummary?: string;
}): string {
  const sections = [
    'Return the next Continuum state updates as JSON only.',
    'Continuum context:',
    '- The current form is already on screen in the browser.',
    '- The user wants this current form adjusted or populated.',
    '- The runtime will apply your response directly to the current session values.',
    '- Stay within value updates only. Do not return structural or full-view output.',
    '',
    'Selected targets:',
    args.selectedTargets.length > 0
      ? JSON.stringify(args.selectedTargets, null, 2)
      : 'none selected; infer the smallest safe matching targets from the available state targets below.',
    '',
    'Available state targets:',
    JSON.stringify(args.stateTargets, null, 2),
    '',
    'Current state values:',
    JSON.stringify(args.currentData ?? null, null, 2),
    '',
  ];
  if (
    typeof args.conversationSummary === 'string' &&
    args.conversationSummary.trim().length > 0
  ) {
    sections.push(
      'Recent conversation summary (bounded):',
      args.conversationSummary.trim(),
      ''
    );
  }
  sections.push('Instruction:', args.instruction.trim());
  if (args.supplementalContext && args.supplementalContext.trim().length > 0) {
    sections.push('', args.supplementalContext.trim());
  }
  return sections.join('\n');
}
