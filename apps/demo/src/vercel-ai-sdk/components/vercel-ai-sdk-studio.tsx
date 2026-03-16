import { DefaultChatTransport } from 'ai';
import type { ViewDefinition } from '@continuum-dev/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import { useContinuumStreaming, useContinuumStreams } from '@continuum-dev/react';
import { useResponsiveState } from '../../ui/responsive';
import { space } from '../../ui/tokens';
import { initialVercelAiSdkView } from '../data/initial-view';
import { VercelAiSdkControlsPanel } from './vercel-ai-sdk-controls-panel';
import { VercelAiSdkPreviewPanel } from './vercel-ai-sdk-preview-panel';
import {
  useVercelAiSdkDemoSettings,
  VERCEL_AI_SDK_API_KEY_HEADER,
} from '../hooks/use-vercel-ai-sdk-demo-settings';
import { useDraftPreviewFocusLock } from '../hooks/use-draft-preview-focus-lock';

const splitLayoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
  gap: space.lg,
  alignItems: 'start',
} as const;

export function VercelAiSdkStudio() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const streaming = useContinuumStreaming();
  const streams = useContinuumStreams();
  const settings = useVercelAiSdkDemoSettings();
  const { isMobile } = useResponsiveState();
  const [isGenerating, setIsGenerating] = useState(false);
  const latestViewRef = useRef<ViewDefinition>(initialVercelAiSdkView);

  useEffect(() => {
    if (!snapshot) {
      session.pushView(initialVercelAiSdkView);
    }
  }, [session, snapshot]);

  const liveView = snapshot?.view ?? initialVercelAiSdkView;

  useEffect(() => {
    latestViewRef.current = liveView;
  }, [liveView]);

  const preview = useDraftPreviewFocusLock({
    liveView,
    streams,
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api:
          settings.mode === 'live'
            ? '/api/vercel-ai-sdk/chat'
            : '/api/vercel-ai-sdk/demo',
        headers: () => {
          const headers = new Headers();

          if (settings.mode === 'live' && settings.hasUsableBrowserKey) {
            headers.set(VERCEL_AI_SDK_API_KEY_HEADER, settings.trimmedApiKey);
          }

          return headers;
        },
        body: () => ({
          providerId: settings.providerId,
          model: settings.resolvedModel,
          currentView: latestViewRef.current,
          currentData: session.getSnapshot()?.data.values ?? null,
        }),
      }),
    [
      session,
      settings.hasUsableBrowserKey,
      settings.mode,
      settings.providerId,
      settings.resolvedModel,
      settings.trimmedApiKey,
    ]
  );

  const chatRuntimeKey = [
    settings.mode,
    settings.providerId,
    settings.resolvedModel,
    settings.trimmedApiKey,
    settings.selectedProvider.serverKeyAvailable ? 'env' : 'no-env',
  ].join(':');

  const previewStatusText =
    preview.draftPreviewStream &&
    preview.lockedDraftStreamId === preview.draftPreviewStream.streamId
      ? 'Draft preview updates are paused while you type. Your edits still apply to the active draft stream.'
      : preview.draftPreviewStream?.latestStatus?.status ??
        streaming.activeStream?.latestStatus?.status ??
        (isGenerating || streaming.isStreaming
          ? preview.draftPreviewStream
            ? 'Streaming draft Continuum view snapshots into a non-live preview stream.'
            : 'Streaming Continuum update parts directly into the active session.'
          : null);

  return (
    <div
      style={{
        ...splitLayoutStyle,
        gridTemplateColumns: isMobile
          ? 'minmax(0, 1fr)'
          : splitLayoutStyle.gridTemplateColumns,
      }}
    >
      <VercelAiSdkControlsPanel
        initialView={initialVercelAiSdkView}
        isMobile={isMobile}
        settings={settings}
        chatRuntimeKey={chatRuntimeKey}
        transport={transport}
        onSubmittingChange={setIsGenerating}
        onError={() => {
          setIsGenerating(false);
        }}
      />
      <VercelAiSdkPreviewPanel
        previewFrameRef={preview.previewFrameRef}
        previewStatusText={previewStatusText}
        isGenerating={isGenerating}
        renderedView={preview.renderedView}
        snapshotOverride={preview.draftPreviewSnapshot}
        renderScope={preview.renderScope}
      />
    </div>
  );
}
