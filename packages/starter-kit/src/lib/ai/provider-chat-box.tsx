import type {
  AiConnectClient,
  AiConnectGenerateResult,
} from '@continuum-dev/ai-connect';
import type {
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import { color, control, radius, space, type as typography } from '../tokens.js';
import { useProviderChatController } from './use-provider-chat-controller.js';
import type { StarterKitViewAuthoringFormat } from './view-authoring.js';

export interface StarterKitProviderChatBoxProps {
  providers: AiConnectClient[];
  mode?: PromptMode;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: StarterKitViewAuthoringFormat;
  autoApplyView?: boolean;
  instructionLabel?: string;
  instructionPlaceholder?: string;
  submitLabel?: string;
  enableSuggestedPrompts?: boolean;
  suggestedPrompts?: string[];
  onResult?: (result: AiConnectGenerateResult, parsed: unknown) => void;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function StarterKitProviderChatBox({
  providers,
  mode = 'evolve-view',
  addons,
  outputContract,
  authoringFormat = 'line-dsl',
  autoApplyView = true,
  instructionLabel = 'Instruction',
  instructionPlaceholder = 'Describe the view update you want...',
  submitLabel = 'Run AI update',
  enableSuggestedPrompts = false,
  suggestedPrompts,
  onResult,
  onError,
  onSubmittingChange,
}: StarterKitProviderChatBoxProps) {
  const {
    listedProviders,
    providerId,
    instruction,
    isSubmitting,
    status,
    errorText,
    copiedPrompt,
    setProviderId,
    setInstruction,
    submit,
    copyPrompt,
  } = useProviderChatController({
    providers,
    mode,
    addons,
    outputContract,
    authoringFormat,
    autoApplyView,
    onResult,
    onError,
    onSubmittingChange,
  });

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
                    copyPrompt(prompt);
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
