import { useEffect, useMemo, useState } from 'react';
import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import { createAiConnectRegistry } from '@continuum-dev/ai-connect';
import type { ViewDefinition } from '@continuum-dev/core';
import {
  assembleSystemPrompt,
  buildCorrectionUserMessage,
  buildCreateUserMessage,
  buildEvolveUserMessage,
  getDefaultOutputContract,
  type PromptAddon,
  type PromptMode,
  type PromptOutputContract,
} from '@continuum-dev/prompts';
import { useContinuumSession } from '@continuum-dev/react';
import { color, control, radius, space, type as typography } from '../tokens.js';

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function isViewDefinition(value: unknown): value is ViewDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.viewId === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.nodes)
  );
}

const SUPPORTED_NODE_TYPES = new Set([
  'field',
  'textarea',
  'date',
  'select',
  'radio-group',
  'slider',
  'toggle',
  'action',
  'group',
  'row',
  'grid',
  'collection',
  'presentation',
]);

function collectUnsupportedNodeTypes(nodes: unknown[]): string[] {
  const unsupported = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') {
      return;
    }

    const asRecord = node as Record<string, unknown>;
    const type = asRecord.type;
    if (typeof type === 'string' && !SUPPORTED_NODE_TYPES.has(type)) {
      unsupported.add(type);
    }

    if (Array.isArray(asRecord.children)) {
      for (const child of asRecord.children) {
        visit(child);
      }
    }

    if (asRecord.template && typeof asRecord.template === 'object') {
      visit(asRecord.template);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return [...unsupported];
}

function collectStructuralErrors(nodes: unknown[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  function visit(node: unknown, path: string): void {
    if (!node || typeof node !== 'object') {
      errors.push(`${path} is not an object node.`);
      return;
    }

    const asRecord = node as Record<string, unknown>;
    const type = asRecord.type;
    const id = asRecord.id;

    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push(`${path} is missing a valid id.`);
    } else if (seenIds.has(id)) {
      errors.push(`${path} uses duplicate id "${id}".`);
    } else {
      seenIds.add(id);
    }

    if (typeof type !== 'string' || !SUPPORTED_NODE_TYPES.has(type)) {
      errors.push(`${path} has unsupported type "${String(type)}".`);
      return;
    }

    if (type === 'group' || type === 'row' || type === 'grid') {
      if (!Array.isArray(asRecord.children)) {
        errors.push(`${path} (${String(type)}) is missing children[].`);
      } else {
        for (let index = 0; index < asRecord.children.length; index += 1) {
          visit(asRecord.children[index], `${path}.children[${index}]`);
        }
      }
    }

    if (type === 'collection') {
      const template = asRecord.template;
      if (!template || typeof template !== 'object') {
        errors.push(`${path} (collection) is missing template node.`);
      } else {
        visit(template, `${path}.template`);
      }
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    visit(nodes[index], `nodes[${index}]`);
  }

  return errors;
}

function buildGeminiRepairUserMessage(args: {
  instruction: string;
  currentView: ViewDefinition;
  malformedText: string;
  errors: string[];
}): string {
  return [
    `Current view:\n${JSON.stringify(args.currentView, null, 2)}`,
    `Original instruction:\n${args.instruction}`,
    `Invalid candidate JSON returned previously:\n${args.malformedText}`,
    `Validation errors to fix:\n${args.errors.join('\n')}`,
    'Return one corrected full ViewDefinition JSON only. Do not include commentary.',
  ].join('\n\n');
}

function makeUniqueId(baseId: string, usedIds: Set<string>): string {
  let candidate = baseId || 'node';
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId || 'node'}_${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizeNode(
  input: unknown,
  usedIds: Set<string>
): Record<string, unknown> {
  const source = (input && typeof input === 'object'
    ? (input as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const type = typeof source.type === 'string' ? source.type : 'presentation';
  const normalized: Record<string, unknown> = { ...source, type };

  normalized.id = makeUniqueId(
    typeof source.id === 'string' ? source.id : 'node',
    usedIds
  );

  if (type === 'field' && typeof source.dataType !== 'string') {
    normalized.dataType = 'string';
  }

  if (type === 'action') {
    if (typeof source.intentId !== 'string' || source.intentId.trim().length === 0) {
      normalized.intentId = `${String(normalized.id)}.submit`;
    }
    if (typeof source.label !== 'string' || source.label.trim().length === 0) {
      normalized.label = 'Submit';
    }
  }

  if (type === 'presentation') {
    if (
      typeof source.contentType !== 'string' ||
      (source.contentType !== 'text' && source.contentType !== 'markdown')
    ) {
      normalized.contentType = 'text';
    }
    if (typeof source.content !== 'string') {
      normalized.content = '';
    }
  }

  if (type === 'group' || type === 'row' || type === 'grid') {
    const children = Array.isArray(source.children)
      ? source.children
      : source.template && typeof source.template === 'object'
      ? [source.template]
      : [];
    normalized.children = children.map((child) => normalizeNode(child, usedIds));
    delete normalized.template;
  }

  if (type === 'collection') {
    const templateSource =
      source.template && typeof source.template === 'object'
        ? source.template
        : { id: `${String(normalized.id)}_item`, type: 'group', children: [] };
    normalized.template = normalizeNode(templateSource, usedIds);
  }

  return normalized;
}

function normalizeViewDefinition(view: ViewDefinition): ViewDefinition {
  const usedIds = new Set<string>();
  return {
    viewId: view.viewId,
    version: view.version,
    nodes: (Array.isArray(view.nodes) ? view.nodes : []).map((node) =>
      normalizeNode(node, usedIds)
    ) as unknown as ViewDefinition['nodes'],
  };
}

function buildRuntimeErrors(issues: unknown[]): string[] {
  return issues.map((issue) => {
    if (!issue || typeof issue !== 'object') {
      return String(issue);
    }
    const asRecord = issue as Record<string, unknown>;
    if (typeof asRecord.message === 'string') {
      return asRecord.message;
    }
    return JSON.stringify(issue);
  });
}

function shouldStartFromScratch(instruction: string): boolean {
  const normalized = instruction.toLowerCase();
  const createSignals = [
    'new form',
    'brand new form',
    'from scratch',
    'start over',
    'replace this form',
    'replace the form',
    'clear the old form',
    'fresh form',
    'different form',
    'new workflow',
  ];
  return createSignals.some((signal) => normalized.includes(signal));
}

export function StarterKitProviderChatBox({
  providers,
  mode = 'evolve-view',
  addons,
  outputContract,
  autoApplyView = true,
  instructionLabel = 'Instruction',
  instructionPlaceholder = 'Describe the view update you want...',
  submitLabel = 'Run AI update',
  enableSuggestedPrompts = false,
  suggestedPrompts,
  onResult,
  onError,
  onSubmittingChange,
}: {
  providers: AiConnectClient[];
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  autoApplyView?: boolean;
  instructionLabel?: string;
  instructionPlaceholder?: string;
  submitLabel?: string;
  enableSuggestedPrompts?: boolean;
  suggestedPrompts?: string[];
  onResult?: (result: AiConnectGenerateResult, parsed: unknown) => void;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}) {
  const session = useContinuumSession();
  const registry = useMemo(() => createAiConnectRegistry(providers), [providers]);
  const listedProviders = registry.list();
  const [providerId, setProviderId] = useState(listedProviders[0]?.id ?? '');
  const [instruction, setInstruction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (listedProviders.length === 0) {
      setProviderId('');
      return;
    }

    const hasProvider = listedProviders.some((provider) => provider.id === providerId);
    if (!hasProvider) {
      setProviderId(listedProviders[0].id);
    }
  }, [listedProviders, providerId]);

  async function submit(): Promise<void> {
    if (isSubmitting || !instruction.trim()) {
      return;
    }

    setIsSubmitting(true);
    onSubmittingChange?.(true);
    setErrorText(null);
    setStatus(null);

    try {
      const activeProviderId = listedProviders.some(
        (provider) => provider.id === providerId
      )
        ? providerId
        : listedProviders[0]?.id;

      if (!activeProviderId) {
        throw new Error('No AI provider is configured.');
      }

      const selectedProvider = registry.get(activeProviderId);
      const runMode =
        mode === 'evolve-view' && shouldStartFromScratch(instruction)
          ? 'create-view'
          : mode;
      const activeContract = outputContract ?? getDefaultOutputContract();
      const systemPrompt = assembleSystemPrompt({
        mode: runMode,
        addons,
        outputContract: activeContract,
      });

      const snapshot = session.getSnapshot();
      if (!snapshot) {
        throw new Error('No active Continuum snapshot is available yet.');
      }

      const issues = session.getIssues();
      const userMessage =
        runMode === 'create-view'
          ? buildCreateUserMessage(instruction)
          : runMode === 'correction-loop'
          ? buildCorrectionUserMessage({
              currentView: snapshot.view,
              instruction,
              validationErrors: issues.map((issue) => JSON.stringify(issue)),
              runtimeErrors: buildRuntimeErrors(issues),
              detachedNodeIds: Object.keys(session.getDetachedValues()),
            })
          : buildEvolveUserMessage({
              currentView: snapshot.view,
              instruction,
            });

      const result = await selectedProvider.generate({
        systemPrompt,
        userMessage,
        outputContract: activeContract,
        temperature: selectedProvider.kind === 'google' ? 0.1 : undefined,
        maxTokens: selectedProvider.kind === 'google' ? 100000 : undefined,
      });

      let finalResult = result;
      let parsed = result.json ?? parseJson(result.text);

      const isGoogle = selectedProvider.kind === 'google';
      if (autoApplyView && isGoogle) {
        const candidateErrors: string[] = [];
        if (!isViewDefinition(parsed)) {
          candidateErrors.push('Top-level JSON is not a valid ViewDefinition object.');
        } else {
          const unsupported = collectUnsupportedNodeTypes(parsed.nodes);
          if (unsupported.length > 0) {
            candidateErrors.push(
              `Unsupported node types: ${unsupported.join(', ')}.`
            );
          }
          candidateErrors.push(...collectStructuralErrors(parsed.nodes));
        }

        if (candidateErrors.length > 0) {
          const repairPrompt = assembleSystemPrompt({
            mode: 'correction-loop',
            addons,
            outputContract: activeContract,
          });
          const repairUserMessage = buildGeminiRepairUserMessage({
            instruction,
            currentView: snapshot.view,
            malformedText: result.text,
            errors: candidateErrors.slice(0, 8),
          });
          finalResult = await selectedProvider.generate({
            systemPrompt: repairPrompt,
            userMessage: repairUserMessage,
            outputContract: activeContract,
            temperature: 0.1,
            maxTokens: 100000,
          });
          parsed = finalResult.json ?? parseJson(finalResult.text);
        }
      }

      if (autoApplyView && isViewDefinition(parsed)) {
        const normalizedView = normalizeViewDefinition(parsed);
        const unsupported = collectUnsupportedNodeTypes(normalizedView.nodes);
        if (unsupported.length > 0) {
          throw new Error(
            `Unsupported node types returned: ${unsupported.join(
              ', '
            )}. Supported types: ${[...SUPPORTED_NODE_TYPES].join(', ')}.`
          );
        }
        const structuralErrors = collectStructuralErrors(normalizedView.nodes);
        if (structuralErrors.length > 0) {
          throw new Error(`Malformed view from model: ${structuralErrors[0]}`);
        }
        session.pushView(normalizedView);
        setStatus(
          `Applied view ${normalizedView.viewId}@${normalizedView.version} from ${selectedProvider.label}.`
        );
      } else {
        setStatus(`Received response from ${selectedProvider.label}.`);
      }

      onResult?.(finalResult, parsed);
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(String(error));
      setErrorText(normalized.message);
      onError?.(normalized);
    } finally {
      setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        background: color.surface,
        alignContent: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: space.xs }}>
        <div style={{ ...typography.section, color: color.text }}>
          AI Provider Chat
        </div>
        <div style={{ ...typography.small, color: color.textMuted }}>
          Send instructions to your configured provider and optionally apply the
          returned Continuum view.
        </div>
      </div>

      {listedProviders.length > 1 ? (
        <label style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typography.label, color: color.textSoft }}>
            Provider
          </span>
          <select
            value={providerId}
            onChange={(event) => {
              setProviderId(event.target.value);
            }}
            disabled={isSubmitting}
            style={{
              boxSizing: 'border-box',
              height: control.height,
              borderRadius: radius.md,
              border: `1px solid ${color.border}`,
              padding: `0 ${space.md}px`,
              ...typography.body,
            }}
          >
            {listedProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label style={{ display: 'grid', gap: space.xs }}>
        <span style={{ ...typography.label, color: color.textSoft }}>
          {instructionLabel}
        </span>
        <textarea
          value={instruction}
          onChange={(event) => {
            setInstruction(event.target.value);
          }}
          placeholder={instructionPlaceholder}
          rows={5}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: 120,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            padding: `${space.sm}px ${space.md}px`,
            resize: 'vertical',
            ...typography.body,
          }}
        />
      </label>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: space.sm,
        }}
      >
        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={isSubmitting || !instruction.trim()}
          style={{
            boxSizing: 'border-box',
            height: control.height,
            padding: `0 ${space.lg}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            background: color.accent,
            color: color.surface,
            cursor: isSubmitting ? 'wait' : 'pointer',
            ...typography.body,
            fontWeight: 600,
          }}
        >
          {isSubmitting ? 'Running...' : submitLabel}
        </button>
      </div>

      {status ? (
        <div style={{ ...typography.small, color: color.textMuted }}>{status}</div>
      ) : null}
      {errorText ? (
        <div style={{ ...typography.small, color: '#a91b0d' }}>{errorText}</div>
      ) : null}

      {enableSuggestedPrompts && suggestedPrompts && suggestedPrompts.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: space.sm,
            paddingTop: space.sm,
            borderTop: `1px solid ${color.borderSoft}`,
          }}
        >
          <span style={{ ...typography.label, color: color.textSoft }}>
            Suggested prompts
          </span>
          {suggestedPrompts.map((prompt) => (
              <div
                key={prompt}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: space.sm,
                  padding: `${space.sm}px ${space.md}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${color.borderSoft}`,
                  background: color.surfaceMuted,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setInstruction(prompt);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                    ...typography.small,
                    color: color.text,
                  }}
                >
                  {prompt}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(prompt);
                      setCopiedPrompt(prompt);
                    }
                  }}
                  style={{
                    boxSizing: 'border-box',
                    height: 32,
                    padding: `0 ${space.md}px`,
                    borderRadius: radius.md,
                    border: `1px solid ${color.border}`,
                    background: color.surface,
                    color: color.text,
                    cursor: 'pointer',
                    ...typography.small,
                    fontWeight: 600,
                  }}
                >
                  {copiedPrompt === prompt ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
