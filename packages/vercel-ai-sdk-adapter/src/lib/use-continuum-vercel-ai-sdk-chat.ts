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

function shouldApplyContinuumPartImmediately(
  part: { type: string; transient?: boolean }
): boolean {
  return (
    part.transient === true &&
    (part.type === 'data-continuum-view' ||
      part.type === 'data-continuum-status' ||
      part.type === 'data-continuum-node-status')
  );
}

function getMessagesForContinuumApplyScan<
  UI_MESSAGE extends ContinuumVercelAiSdkMessage,
>(
  messages: readonly UI_MESSAGE[],
  status: UseChatHelpers<UI_MESSAGE>['status']
): readonly UI_MESSAGE[] {
  if (status === 'streaming' || status === 'submitted') {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        return messages.slice(i);
      }
    }
    return [];
  }
  return messages;
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
  const immediatelyAppliedTransientPartIdsRef = useRef<Set<string>>(new Set());
  const pendingStreamIdsRef = useRef<Set<string>>(new Set());
  const [latestContinuumEvent, setLatestContinuumEvent] =
    useState<ContinuumVercelAiSdkPartApplication | null>(null);
  const [latestStatus, setLatestStatus] =
    useState<ContinuumVercelAiSdkStatusData | null>(null);

  const chat = useChat<UI_MESSAGE>({
    ...chatOptions,
    onData: (part) => {
      if (isContinuumVercelAiSdkDataPart(part)) {
        if (
          autoApplyMessages &&
          shouldApplyContinuumPartImmediately(part) &&
          (!part.id || !immediatelyAppliedTransientPartIdsRef.current.has(part.id))
        ) {
          const application = applyContinuumVercelAiSdkDataPart(
            part,
            continuumSession
          );

          if (part.id) {
            immediatelyAppliedTransientPartIdsRef.current.add(part.id);
            appliedPartKeysRef.current.add(part.id);
          }

          if (
            'streamId' in application &&
            typeof application.streamId === 'string' &&
            application.streamId.length > 0
          ) {
            const stream = continuumSession
              .getStreams?.()
              ?.find((candidate) => candidate.streamId === application.streamId);
            if (stream?.status === 'open') {
              pendingStreamIdsRef.current.add(application.streamId);
            }
          }

          if (application.kind === 'status') {
            const nextStatus = {
              status: application.status,
              level: application.level,
            } satisfies ContinuumVercelAiSdkStatusData;
            setLatestStatus(nextStatus);
          }

          if (application.kind !== 'ignored') {
            setLatestContinuumEvent(application);
            onContinuumPart?.(application);
          }
        } else if (part.type === 'data-continuum-status') {
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
      }

      onData?.(part);
    },
  });

  useEffect(() => {
    if (chat.messages.length === 0) {
      appliedPartKeysRef.current.clear();
      immediatelyAppliedTransientPartIdsRef.current.clear();
      pendingStreamIdsRef.current.clear();
      return;
    }

    if (!autoApplyMessages) {
      return;
    }

    const messagesToScan = getMessagesForContinuumApplyScan(
      chat.messages,
      chat.status
    );

    for (const message of messagesToScan) {
      if (message.role !== 'assistant') {
        continue;
      }

      message.parts.forEach((part, index) => {
        if (!isDataUIPart(part) || !isContinuumVercelAiSdkDataPart(part)) {
          return;
        }

        if (
          part.id &&
          immediatelyAppliedTransientPartIdsRef.current.has(part.id)
        ) {
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
        if (
          'streamId' in application &&
          typeof application.streamId === 'string' &&
          application.streamId.length > 0
        ) {
          const stream = continuumSession
            .getStreams?.()
            ?.find((candidate) => candidate.streamId === application.streamId);
          if (stream?.status === 'open') {
            pendingStreamIdsRef.current.add(application.streamId);
          } else {
            pendingStreamIdsRef.current.delete(application.streamId);
          }
        }
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
  }, [
    autoApplyMessages,
    chat.messages,
    chat.status,
    continuumSession,
    onContinuumPart,
  ]);

  useEffect(() => {
    if (chat.status === 'submitted') {
      immediatelyAppliedTransientPartIdsRef.current.clear();
    }
  }, [chat.status]);

  useEffect(() => {
    if (pendingStreamIdsRef.current.size === 0) {
      return;
    }

    if (chat.status !== 'ready' && chat.status !== 'error') {
      return;
    }

    const streamIds = [...pendingStreamIdsRef.current];
    pendingStreamIdsRef.current.clear();

    for (const streamId of streamIds) {
      const stream = continuumSession
        .getStreams?.()
        ?.find((candidate) => candidate.streamId === streamId);
      if (!stream || stream.status !== 'open') {
        continue;
      }

      if (chat.status === 'error') {
        continuumSession.abortStream?.(streamId, 'AI stream ended with error');
        continue;
      }

      continuumSession.commitStream?.(streamId);
    }
  }, [chat.status, continuumSession]);

  return {
    ...chat,
    continuumSession,
    latestContinuumEvent,
    latestStatus,
  };
}
