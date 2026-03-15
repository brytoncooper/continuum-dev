import type {
  ContinuumVercelAiSdkMessage,
  UseContinuumVercelAiSdkChatOptions,
} from '@continuum-dev/vercel-ai-sdk';
import { StarterKitChatBoxShell } from './chat-box-shell.js';
import { useVercelAiSdkChatController } from './use-vercel-ai-sdk-chat-controller.js';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type SessionlessVercelAiSdkChatOptions<T extends ContinuumVercelAiSdkMessage> =
  DistributiveOmit<UseContinuumVercelAiSdkChatOptions<T>, 'session'>;

export interface StarterKitVercelAiSdkChatBoxProps {
  chatOptions?: SessionlessVercelAiSdkChatOptions<ContinuumVercelAiSdkMessage>;
  instructionLabel?: string;
  instructionPlaceholder?: string;
  submitLabel?: string;
  submitDisabled?: boolean;
  enableSuggestedPrompts?: boolean;
  suggestedPrompts?: string[];
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function StarterKitVercelAiSdkChatBox({
  chatOptions,
  instructionLabel = 'Instruction',
  instructionPlaceholder = 'Describe the view update you want...',
  submitLabel = 'Run AI update',
  submitDisabled = false,
  enableSuggestedPrompts = false,
  suggestedPrompts,
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
      title="Vercel AI SDK Chat"
      description="Send instructions through Vercel AI SDK and auto-apply streamed Continuum view or state updates into the active session."
      instructionLabel={instructionLabel}
      instructionPlaceholder={instructionPlaceholder}
      submitLabel={submitLabel}
      submitDisabled={submitDisabled}
      enableSuggestedPrompts={enableSuggestedPrompts}
      suggestedPrompts={suggestedPrompts}
      {...controller}
    />
  );
}
