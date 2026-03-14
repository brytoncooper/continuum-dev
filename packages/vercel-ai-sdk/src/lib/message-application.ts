import { isDataUIPart } from 'ai';
import { applyContinuumViewPatch } from '@continuum-dev/core';
import { createContinuumVercelAiSdkSessionAdapter } from './session-adapter.js';
import { isContinuumVercelAiSdkDataPart } from './data-parts.js';
import type {
  ContinuumVercelAiSdkDataChunk,
  ContinuumVercelAiSdkDataPart,
  ContinuumVercelAiSdkMessage,
  ContinuumVercelAiSdkPartApplication,
  ContinuumVercelAiSdkSessionAdapter,
  ContinuumVercelAiSdkSessionLike,
} from './types.js';

type ApplicablePart =
  | ContinuumVercelAiSdkDataPart
  | ContinuumVercelAiSdkDataChunk;

const CONTINUUM_VERCEL_AI_SDK_SOURCE = 'vercel-ai-sdk';

export function interpretContinuumVercelAiSdkDataPart(
  part: ApplicablePart
): ContinuumVercelAiSdkPartApplication {
  switch (part.type) {
    case 'data-continuum-view':
      return {
        kind: 'view',
        view: part.data.view,
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-patch':
      return {
        kind: 'patch',
        patch: part.data.patch,
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-state':
      return {
        kind: 'state',
        nodeId: part.data.nodeId,
        value: part.data.value,
      };
    case 'data-continuum-reset':
      return {
        kind: 'reset',
        reason: part.data.reason,
      };
    case 'data-continuum-status':
      return {
        kind: 'status',
        status: part.data.status,
        level: part.data.level ?? 'info',
      };
    default:
      return {
        kind: 'ignored',
        reason: `Unsupported Continuum AI SDK UI part: ${String(
          (part as { type?: unknown }).type
        )}`,
      };
  }
}

export function applyContinuumVercelAiSdkDataPart(
  part: ApplicablePart,
  session:
    | ContinuumVercelAiSdkSessionAdapter
    | ContinuumVercelAiSdkSessionLike
): ContinuumVercelAiSdkPartApplication {
  const sessionAdapter = createContinuumVercelAiSdkSessionAdapter(session);
  const application = interpretContinuumVercelAiSdkDataPart(part);

  if (application.kind === 'view') {
    sessionAdapter.applyView(application.view, {
      transient: application.transient,
    });
    return application;
  }

  if (application.kind === 'patch') {
    const currentView = sessionAdapter.getSnapshot()?.view;
    if (!currentView) {
      return {
        kind: 'ignored',
        reason:
          'Received continuum patch part before a session view existed to apply it against.',
      };
    }

    sessionAdapter.applyView(
      applyContinuumViewPatch(currentView, application.patch),
      {
        transient: application.transient,
      }
    );
    return application;
  }

  if (application.kind === 'state') {
    if (typeof sessionAdapter.proposeValue === 'function') {
      sessionAdapter.proposeValue(
        application.nodeId,
        application.value,
        CONTINUUM_VERCEL_AI_SDK_SOURCE
      );
      return application;
    }

    sessionAdapter.updateState(application.nodeId, application.value);
    return application;
  }

  if (application.kind === 'reset') {
    if (typeof sessionAdapter.reset === 'function') {
      sessionAdapter.reset();
      return application;
    }

    return {
      kind: 'ignored',
      reason: 'Received continuum reset part, but the session adapter does not expose reset().',
    };
  }

  return application;
}

export function applyContinuumVercelAiSdkMessage(
  message: ContinuumVercelAiSdkMessage,
  session:
    | ContinuumVercelAiSdkSessionAdapter
    | ContinuumVercelAiSdkSessionLike
): ContinuumVercelAiSdkPartApplication[] {
  const applications: ContinuumVercelAiSdkPartApplication[] = [];

  for (const part of message.parts) {
    if (!isDataUIPart(part) || !isContinuumVercelAiSdkDataPart(part)) {
      continue;
    }

    applications.push(applyContinuumVercelAiSdkDataPart(part, session));
  }

  return applications;
}

export function applyContinuumVercelAiSdkMessages(
  messages: ContinuumVercelAiSdkMessage[],
  session:
    | ContinuumVercelAiSdkSessionAdapter
    | ContinuumVercelAiSdkSessionLike
): ContinuumVercelAiSdkPartApplication[] {
  return messages.flatMap((message) =>
    applyContinuumVercelAiSdkMessage(message, session)
  );
}
