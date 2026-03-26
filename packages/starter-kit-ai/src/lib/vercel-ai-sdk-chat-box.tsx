import type {
  ContinuumVercelAiSdkMessage,
  UseContinuumVercelAiSdkChatOptions,
} from '@continuum-dev/vercel-ai-sdk-adapter';
import { StarterKitChatBoxShell } from './chat-box-shell.js';
import { useVercelAiSdkChatController } from './use-vercel-ai-sdk-chat-controller.js';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type SessionlessVercelAiSdkChatOptions<T extends ContinuumVercelAiSdkMessage> =
  DistributiveOmit<UseContinuumVercelAiSdkChatOptions<T>, 'session'>;

export interface StarterKitVercelAiSdkChatBoxProps {
  chatOptions?: SessionlessVercelAiSdkChatOptions<ContinuumVercelAiSdkMessage>;
  title?: string;
  description?: string;
  instructionLabel?: string;
  instructionPlaceholder?: string;
  submitLabel?: string;
  submitDisabled?: boolean;
  enableSuggestedPrompts?: boolean;
  suggestedPrompts?: string[];
  showSuggestedPromptCopyButton?: boolean;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function StarterKitVercelAiSdkChatBox({
  chatOptions,
  title,
  description,
  instructionLabel = 'Instruction',
  instructionPlaceholder = 'Describe the view update you want...',
  submitLabel = 'Run AI update',
  submitDisabled = false,
  enableSuggestedPrompts = false,
  suggestedPrompts,
  showSuggestedPromptCopyButton = true,
  onError,
  onSubmittingChange,
}: StarterKitVercelAiSdkChatBoxProps) {
  const controller = useVercelAiSdkChatController({
    chatOptions,
    onError,
    onSubmittingChange,
  });

  return (
    <StarterKitChatBoxShell
      title={title}
      description={description}
      instructionLabel={instructionLabel}
      instructionPlaceholder={instructionPlaceholder}
      submitLabel={submitLabel}
      submitDisabled={submitDisabled}
      enableSuggestedPrompts={enableSuggestedPrompts}
      suggestedPrompts={suggestedPrompts}
      showSuggestedPromptCopyButton={showSuggestedPromptCopyButton}
      {...controller}
    />
  );
}
