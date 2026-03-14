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
import { StarterKitChatBoxShell } from './chat-box-shell.js';
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

  const providerControl =
    listedProviders.length > 1 ? (
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
    ) : null;

  return (
    <StarterKitChatBoxShell
      title="AI Provider Chat"
      description="Send instructions to your configured provider and optionally apply the returned Continuum view."
      providerControl={providerControl}
      instructionLabel={instructionLabel}
      instructionPlaceholder={instructionPlaceholder}
      submitLabel={submitLabel}
      instruction={instruction}
      isSubmitting={isSubmitting}
      status={status}
      errorText={errorText}
      copiedPrompt={copiedPrompt}
      enableSuggestedPrompts={enableSuggestedPrompts}
      suggestedPrompts={suggestedPrompts}
      setInstruction={setInstruction}
      submit={submit}
      copyPrompt={copyPrompt}
    />
  );
}
