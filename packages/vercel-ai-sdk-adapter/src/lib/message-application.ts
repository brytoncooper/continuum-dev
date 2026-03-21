import { isDataUIPart } from 'ai';
import { applyContinuumViewStreamPart } from '@continuum-dev/runtime/view-stream';
import type { SessionStreamMode } from '@continuum-dev/core';
import type { SessionStreamPart } from '@continuum-dev/core';
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

const CONTINUUM_VERCEL_AI_SDK_SOURCE = 'vercel-ai-sdk-adapter';

function readPartStreamMode(
  part: ApplicablePart
): SessionStreamMode | undefined {
  const nestedMode =
    part.data &&
    typeof part.data === 'object' &&
    'streamMode' in part.data &&
    (part.data as { streamMode?: unknown }).streamMode;
  if (nestedMode === 'foreground' || nestedMode === 'draft') {
    return nestedMode;
  }

  const topLevelMode = (part as { streamMode?: unknown }).streamMode;
  if (topLevelMode === 'foreground' || topLevelMode === 'draft') {
    return topLevelMode;
  }

  return undefined;
}

function findOpenStream(
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter,
  targetViewId: string,
  preferredMode?: SessionStreamMode
): { streamId: string; mode: SessionStreamMode } | undefined {
  const openStreams =
    sessionAdapter
      .getStreams?.()
      ?.filter(
        (stream) =>
          stream.status === 'open' && stream.targetViewId === targetViewId
      ) ?? [];

  if (openStreams.length === 0) {
    return undefined;
  }

  const matchingMode = preferredMode
    ? openStreams.find((stream) => stream.mode === preferredMode)
    : undefined;
  const selected = matchingMode ?? openStreams[0];
  if (!selected) {
    return undefined;
  }

  return {
    streamId: selected.streamId,
    mode: selected.mode,
  };
}

function resolveTargetViewId(
  application: ContinuumVercelAiSdkPartApplication,
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter
): string | null {
  switch (application.kind) {
    case 'view':
      return application.view.viewId;
    case 'patch':
    case 'insert-node':
    case 'replace-node':
    case 'remove-node':
    case 'append-content':
    case 'node-status':
      return (
        ('patch' in application ? application.patch.viewId : application.targetViewId) ??
        sessionAdapter.getSnapshot()?.view.viewId ??
        sessionAdapter.getCommittedSnapshot()?.view.viewId ??
        null
      );
    case 'state':
    case 'status':
      return (
        sessionAdapter.getSnapshot()?.view.viewId ??
        sessionAdapter.getCommittedSnapshot()?.view.viewId ??
        null
      );
    default:
      return null;
  }
}

function normalizeStreamPart(
  application: ContinuumVercelAiSdkPartApplication
): SessionStreamPart | null {
  switch (application.kind) {
    case 'view':
      return {
        kind: 'view',
        view: application.view,
        ...(application.transformPlan
          ? { transformPlan: application.transformPlan }
          : {}),
      };
    case 'patch':
      return { kind: 'patch', patch: application.patch };
    case 'insert-node':
      return {
        kind: 'insert-node',
        parentId: application.parentId,
        position: application.position,
        node: application.node,
      };
    case 'replace-node':
      return {
        kind: 'replace-node',
        nodeId: application.nodeId,
        node: application.node,
      };
    case 'remove-node':
      return {
        kind: 'remove-node',
        nodeId: application.nodeId,
      };
    case 'append-content':
      return {
        kind: 'append-content',
        nodeId: application.nodeId,
        text: application.text,
      };
    case 'state':
      return {
        kind: 'state',
        nodeId: application.nodeId,
        value: application.value,
        source: CONTINUUM_VERCEL_AI_SDK_SOURCE,
      };
    case 'status':
      return {
        kind: 'status',
        status: application.status,
        level: application.level,
      };
    case 'node-status':
      return {
        kind: 'node-status',
        nodeId: application.nodeId,
        status: application.status,
        level: application.level,
        ...(application.subtree ? { subtree: true } : {}),
      };
    default:
      return null;
  }
}

function applyThroughStreamingFoundation(
  application: ContinuumVercelAiSdkPartApplication,
  sessionAdapter: ContinuumVercelAiSdkSessionAdapter
): ContinuumVercelAiSdkPartApplication {
  if (
    typeof sessionAdapter.beginStream !== 'function' ||
    typeof sessionAdapter.applyStreamPart !== 'function' ||
    typeof sessionAdapter.commitStream !== 'function'
  ) {
    return application;
  }

  const streamPart = normalizeStreamPart(application);
  const targetViewId = resolveTargetViewId(application, sessionAdapter);
  const preferredStreamMode =
    'streamMode' in application ? application.streamMode ?? 'foreground' : 'foreground';
  if (!streamPart || !targetViewId) {
    return application;
  }

  const shouldRestartStreamFromCommittedBase =
    application.kind === 'view' && Boolean(application.transformPlan);
  const existingStream = shouldRestartStreamFromCommittedBase
    ? undefined
    : findOpenStream(sessionAdapter, targetViewId, preferredStreamMode);
  const streamMode = existingStream?.mode ?? preferredStreamMode;
  let streamId = existingStream?.streamId;
  if (!streamId) {
    streamId = sessionAdapter.beginStream({
      targetViewId,
      source: CONTINUUM_VERCEL_AI_SDK_SOURCE,
      mode: streamMode,
      supersede: true,
      baseViewVersion:
        sessionAdapter.getCommittedSnapshot()?.view.version ??
        sessionAdapter.getSnapshot()?.view.version ??
        null,
    }).streamId;
  }

  sessionAdapter.applyStreamPart(streamId, streamPart);

  if (
    application.kind !== 'status' &&
    application.kind !== 'node-status' &&
    ('transient' in application ? application.transient !== true : true)
  ) {
    const result = sessionAdapter.commitStream(streamId);
    if (result.status !== 'committed') {
      throw new Error(
        `Continuum stream commit failed with status "${result.status}"${result.reason ? `: ${result.reason}` : ''}.`
      );
    }
  }

  return {
    ...application,
    streamMode,
    streamId,
  } as ContinuumVercelAiSdkPartApplication;
}

export function interpretContinuumVercelAiSdkDataPart(
  part: ApplicablePart
): ContinuumVercelAiSdkPartApplication {
  switch (part.type) {
    case 'data-continuum-view':
      return {
        kind: 'view',
        view: part.data.view,
        transformPlan: part.data.transformPlan,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-patch':
      return {
        kind: 'patch',
        patch: part.data.patch,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-insert-node':
      return {
        kind: 'insert-node',
        node: part.data.node,
        parentId: part.data.parentId,
        position: part.data.position,
        targetViewId: part.data.targetViewId,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-replace-node':
      return {
        kind: 'replace-node',
        nodeId: part.data.nodeId,
        node: part.data.node,
        targetViewId: part.data.targetViewId,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-remove-node':
      return {
        kind: 'remove-node',
        nodeId: part.data.nodeId,
        targetViewId: part.data.targetViewId,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-append-content':
      return {
        kind: 'append-content',
        nodeId: part.data.nodeId,
        text: part.data.text,
        targetViewId: part.data.targetViewId,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-state':
      return {
        kind: 'state',
        nodeId: part.data.nodeId,
        value: part.data.value,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
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
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
      };
    case 'data-continuum-node-status':
      return {
        kind: 'node-status',
        nodeId: part.data.nodeId,
        status: part.data.status,
        level: part.data.level ?? 'info',
        subtree: part.data.subtree,
        targetViewId: part.data.targetViewId,
        streamMode: readPartStreamMode(part),
        transient: 'transient' in part ? part.transient === true : undefined,
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
  try {
    if (
      application.kind === 'view' ||
      application.kind === 'patch' ||
      application.kind === 'insert-node' ||
      application.kind === 'replace-node' ||
      application.kind === 'remove-node' ||
      application.kind === 'append-content' ||
      application.kind === 'state' ||
      application.kind === 'status' ||
      application.kind === 'node-status'
    ) {
      const streamed = applyThroughStreamingFoundation(application, sessionAdapter);
      if (
        streamed.kind === 'view' ||
        streamed.kind === 'patch' ||
        streamed.kind === 'insert-node' ||
        streamed.kind === 'replace-node' ||
        streamed.kind === 'remove-node' ||
        streamed.kind === 'append-content' ||
        streamed.kind === 'state' ||
        streamed.kind === 'status' ||
        streamed.kind === 'node-status'
      ) {
        return streamed;
      }
    }

    if (application.kind === 'view') {
      sessionAdapter.applyView(application.view, {
        transient: application.transient,
        transformPlan: application.transformPlan,
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
        applyContinuumViewStreamPart({
          currentView,
          part: { kind: 'patch', patch: application.patch },
        }).view,
        {
          transient: application.transient,
        }
      );
      return application;
    }

    if (
      application.kind === 'insert-node' ||
      application.kind === 'replace-node' ||
      application.kind === 'remove-node' ||
      application.kind === 'append-content'
    ) {
      const currentView = sessionAdapter.getSnapshot()?.view;
      if (!currentView) {
        return {
          kind: 'ignored',
          reason:
            `Received continuum ${application.kind} part before a session view existed to apply it against.`,
        };
      }

      sessionAdapter.applyView(
        applyContinuumViewStreamPart({
          currentView,
          part: application,
        }).view,
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
        reason:
          'Received continuum reset part, but the session adapter does not expose reset().',
      };
    }

    if (application.kind === 'node-status') {
      return {
        kind: 'ignored',
        reason:
          'Received continuum node-status part, but the session adapter does not expose stream support.',
      };
    }

    return application;
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : `Failed to apply continuum ${application.kind} part.`;

    return {
      kind: 'ignored',
      reason: message,
    };
  }
}

export function applyContinuumVercelAiSdkMessage(
  message: ContinuumVercelAiSdkMessage,
  session:
    | ContinuumVercelAiSdkSessionAdapter
    | ContinuumVercelAiSdkSessionLike
): ContinuumVercelAiSdkPartApplication[] {
  const applications: ContinuumVercelAiSdkPartApplication[] = [];
  const touchedStreamIds = new Set<string>();

  for (const part of message.parts) {
    if (!isDataUIPart(part) || !isContinuumVercelAiSdkDataPart(part)) {
      continue;
    }

    const application = applyContinuumVercelAiSdkDataPart(part, session);
    applications.push(application);
    if (
      'streamId' in application &&
      typeof application.streamId === 'string' &&
      application.streamId.length > 0
    ) {
      touchedStreamIds.add(application.streamId);
    }
  }

  const sessionAdapter = createContinuumVercelAiSdkSessionAdapter(session);
  if (
    typeof sessionAdapter.commitStream === 'function' &&
    typeof sessionAdapter.getStreams === 'function'
  ) {
    for (const streamId of touchedStreamIds) {
      const stream = sessionAdapter.getStreams()?.find(
        (candidate) => candidate.streamId === streamId
      );
      if (!stream || stream.status !== 'open') {
        continue;
      }
      const result = sessionAdapter.commitStream(streamId);
      if (result.status !== 'committed') {
        throw new Error(
          `Continuum stream commit failed with status "${result.status}"${result.reason ? `: ${result.reason}` : ''}.`
        );
      }
    }
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
