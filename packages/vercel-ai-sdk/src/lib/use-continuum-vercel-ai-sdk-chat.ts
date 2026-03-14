import { useChat, type UseChatHelpers, type UseChatOptions } from '@ai-sdk/react';
import { isDataUIPart, type ChatOnDataCallback } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isContinuumVercelAiSdkDataPart } from './data-parts.js';
import {
  applyContinuumVercelAiSdkDataPart,
  interpretContinuumVercelAiSdkDataPart,
} from './message-application.js';
import { createContinuumVercelAiSdkSessionAdapter } from './session-adapter.js';
import type {
  ContinuumVercelAiSdkMessage,
  ContinuumVercelAiSdkPartApplication,
  ContinuumVercelAiSdkSessionAdapter,
  ContinuumVercelAiSdkSessionLike,
  ContinuumVercelAiSdkStatusData,
} from './types.js';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type UseContinuumVercelAiSdkChatOptions<
  UI_MESSAGE extends ContinuumVercelAiSdkMessage = ContinuumVercelAiSdkMessage,
> = DistributiveOmit<UseChatOptions<UI_MESSAGE>, 'onData'> & {
  session:
    | ContinuumVercelAiSdkSessionAdapter
    | ContinuumVercelAiSdkSessionLike;
  autoApplyMessages?: boolean;
  onContinuumPart?: (application: ContinuumVercelAiSdkPartApplication) => void;
  onData?: ChatOnDataCallback<UI_MESSAGE>;
};

export interface UseContinuumVercelAiSdkChatHelpers<
  UI_MESSAGE extends ContinuumVercelAiSdkMessage = ContinuumVercelAiSdkMessage,
> extends UseChatHelpers<UI_MESSAGE> {
  continuumSession: ContinuumVercelAiSdkSessionAdapter;
  latestContinuumEvent: ContinuumVercelAiSdkPartApplication | null;
  latestStatus: ContinuumVercelAiSdkStatusData | null;
}

function buildAppliedPartKey(
  messageId: string,
  index: number,
  part: { id?: string; type: string }
): string {
  return part.id ?? `${messageId}:${index}:${part.type}`;
}

function isTransientPart(part: unknown): boolean {
  return Boolean(
    part &&
      typeof part === 'object' &&
      'transient' in part &&
      (part as { transient?: boolean }).transient === true
  );
}

export function useContinuumVercelAiSdkChat<
  UI_MESSAGE extends ContinuumVercelAiSdkMessage = ContinuumVercelAiSdkMessage,
>(
  options: UseContinuumVercelAiSdkChatOptions<UI_MESSAGE>
): UseContinuumVercelAiSdkChatHelpers<UI_MESSAGE> {
  const {
    session,
    autoApplyMessages = true,
    onContinuumPart,
    onData,
    ...chatOptions
  } = options;
  const continuumSession = useMemo(
    () => createContinuumVercelAiSdkSessionAdapter(session),
    [session]
  );
  const appliedPartKeysRef = useRef<Set<string>>(new Set());
  const [latestContinuumEvent, setLatestContinuumEvent] =
    useState<ContinuumVercelAiSdkPartApplication | null>(null);
  const [latestStatus, setLatestStatus] =
    useState<ContinuumVercelAiSdkStatusData | null>(null);

  const chat = useChat<UI_MESSAGE>({
    ...chatOptions,
    onData: (part) => {
      if (
        isContinuumVercelAiSdkDataPart(part) &&
        part.type === 'data-continuum-status'
      ) {
        const application = interpretContinuumVercelAiSdkDataPart(part);
        if (application.kind === 'status') {
          const nextStatus = {
            status: application.status,
            level: application.level,
          } satisfies ContinuumVercelAiSdkStatusData;
          setLatestStatus(nextStatus);
          setLatestContinuumEvent(application);
          onContinuumPart?.(application);
        }
      }

      onData?.(part);
    },
  });

  useEffect(() => {
    if (chat.messages.length === 0) {
      appliedPartKeysRef.current.clear();
      return;
    }

    if (!autoApplyMessages) {
      return;
    }

    for (const message of chat.messages) {
      if (message.role !== 'assistant') {
        continue;
      }

      message.parts.forEach((part, index) => {
        if (!isDataUIPart(part) || !isContinuumVercelAiSdkDataPart(part)) {
          return;
        }

        if (isTransientPart(part) && part.type !== 'data-continuum-status') {
          return;
        }

        const key = buildAppliedPartKey(message.id, index, part);
        if (appliedPartKeysRef.current.has(key)) {
          return;
        }

        appliedPartKeysRef.current.add(key);

        const application = applyContinuumVercelAiSdkDataPart(
          part,
          continuumSession
        );
        if (application.kind === 'status') {
          setLatestStatus({
            status: application.status,
            level: application.level,
          });
        }
        if (application.kind !== 'ignored') {
          setLatestContinuumEvent(application);
          onContinuumPart?.(application);
        }
      });
    }
  }, [autoApplyMessages, chat.messages, continuumSession, onContinuumPart]);

  return {
    ...chat,
    continuumSession,
    latestContinuumEvent,
    latestStatus,
  };
}
