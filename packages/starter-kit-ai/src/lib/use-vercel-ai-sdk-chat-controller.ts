import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useContinuumVercelAiSdkChat,
  type ContinuumVercelAiSdkMessage,
  type UseContinuumVercelAiSdkChatOptions,
} from '@continuum-dev/vercel-ai-sdk-adapter';
import type { ContinuumSessionLike } from '@continuum-dev/ai-engine';
import { createContinuumSessionAdapter } from '@continuum-dev/ai-engine';
import {
  useContinuumSession,
  useContinuumStreaming,
} from '@continuum-dev/react';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type SessionlessVercelAiSdkChatOptions<T extends ContinuumVercelAiSdkMessage> =
  DistributiveOmit<UseContinuumVercelAiSdkChatOptions<T>, 'session'>;

export interface VercelAiSdkChatControllerArgs {
  chatOptions?: SessionlessVercelAiSdkChatOptions<ContinuumVercelAiSdkMessage>;
  onError?: (error: Error) => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

export interface VercelAiSdkChatControllerState {
  instruction: string;
  isSubmitting: boolean;
  status: string | null;
  errorText: string | null;
  copiedPrompt: string | null;
  attachmentFiles: File[];
  addAttachmentFiles(files: FileList | null): void;
  removeAttachmentAt(index: number): void;
  setInstruction(instruction: string): void;
  submit(): Promise<void>;
  copyPrompt(prompt: string): void;
}

export function useVercelAiSdkChatController(
  args: VercelAiSdkChatControllerArgs
): VercelAiSdkChatControllerState {
  const session = useContinuumSession() as ContinuumSessionLike;
  const streaming = useContinuumStreaming();
  const sessionAdapter = useMemo(
    () => createContinuumSessionAdapter(session),
    [session]
  );
  const [instruction, setInstruction] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const onSubmittingChangeRef = useRef(args.onSubmittingChange);
  const onErrorRef = useRef(args.onError);

  const chat = useContinuumVercelAiSdkChat<ContinuumVercelAiSdkMessage>({
    session: sessionAdapter,
    ...args.chatOptions,
  });
  const isSubmitting =
    chat.status === 'submitted' || chat.status === 'streaming';
  const status =
    streaming.activeStream?.latestStatus?.status ??
    chat.latestStatus?.status ??
    (streaming.isStreaming ? 'Applying streamed Continuum update...' : null) ??
    (chat.status === 'submitted'
      ? 'Submitting request...'
      : chat.status === 'streaming'
      ? 'Streaming response...'
      : null);
  const errorText = chat.error?.message ?? null;

  useEffect(() => {
    onSubmittingChangeRef.current = args.onSubmittingChange;
  }, [args.onSubmittingChange]);

  useEffect(() => {
    onErrorRef.current = args.onError;
  }, [args.onError]);

  useEffect(() => {
    onSubmittingChangeRef.current?.(isSubmitting);
  }, [isSubmitting]);

  useEffect(() => {
    if (chat.error) {
      onErrorRef.current?.(chat.error);
    }
  }, [chat.error]);

  const addAttachmentFiles = useCallback((files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setAttachmentFiles((previous) => [...previous, ...Array.from(files)]);
  }, []);

  const removeAttachmentAt = useCallback((index: number) => {
    setAttachmentFiles((previous) => previous.filter((_, i) => i !== index));
  }, []);

  async function submit(): Promise<void> {
    const hasText = instruction.trim().length > 0;
    const hasFiles = attachmentFiles.length > 0;
    if (isSubmitting || (!hasText && !hasFiles)) {
      return;
    }

    if (chat.status === 'error') {
      chat.clearError();
    }

    if (hasFiles) {
      const dataTransfer = new DataTransfer();
      for (const file of attachmentFiles) {
        dataTransfer.items.add(file);
      }
      if (hasText) {
        await chat.sendMessage({
          text: instruction.trim(),
          files: dataTransfer.files,
        });
      } else {
        await chat.sendMessage({
          files: dataTransfer.files,
        });
      }
      setAttachmentFiles([]);
      return;
    }

    await chat.sendMessage({
      text: instruction.trim(),
    });
  }

  function copyPrompt(prompt: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(prompt);
      setCopiedPrompt(prompt);
    }
  }

  return {
    instruction,
    isSubmitting,
    status,
    errorText,
    copiedPrompt,
    attachmentFiles,
    addAttachmentFiles,
    removeAttachmentAt,
    setInstruction,
    submit,
    copyPrompt,
  };
}
