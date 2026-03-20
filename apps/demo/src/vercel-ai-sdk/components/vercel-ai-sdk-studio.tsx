import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildContinuumVercelAiSdkRequestBody } from '@continuum-dev/vercel-ai-sdk-adapter';
import {
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import { useContinuumStreaming } from '@continuum-dev/react';
import { useResponsiveState } from '../../ui/responsive';
import { space } from '../../ui/tokens';
import { initialVercelAiSdkView } from '../data/initial-view';
import { VercelAiSdkControlsPanel } from './vercel-ai-sdk-controls-panel';
import { VercelAiSdkPreviewPanel } from './vercel-ai-sdk-preview-panel';
import {
  useVercelAiSdkDemoSettings,
  VERCEL_AI_SDK_API_KEY_HEADER,
} from '../hooks/use-vercel-ai-sdk-demo-settings';

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
  const settings = useVercelAiSdkDemoSettings();
  const { isMobile } = useResponsiveState();
  const [isGenerating, setIsGenerating] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const loggedWarningRef = useRef<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      session.pushView(initialVercelAiSdkView);
    }
  }, [session, snapshot]);

  const liveView = snapshot?.view ?? initialVercelAiSdkView;

  const latestStreamStatus = streaming.activeStream?.latestStatus ?? null;

  useEffect(() => {
    if (!latestStreamStatus || latestStreamStatus.level !== 'warning') {
      loggedWarningRef.current = null;
      return;
    }

    const signature = `${latestStreamStatus.level}:${latestStreamStatus.status}`;
    if (loggedWarningRef.current === signature) {
      return;
    }

    loggedWarningRef.current = signature;
    console.warn(
      '[vercel-ai-sdk-demo] Continuum warning:',
      latestStreamStatus.status
    );
  }, [latestStreamStatus]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/vercel-ai-sdk/chat',
        headers: () => {
          const headers = new Headers();

          if (settings.hasUsableBrowserKey) {
            headers.set(VERCEL_AI_SDK_API_KEY_HEADER, settings.trimmedApiKey);
          }

          return headers;
        },
        body: () => {
          // Author new requests from committed state while a transient preview stream is open.
          const requestSnapshot =
            streaming.activeStream != null
              ? session.getCommittedSnapshot() ?? session.getSnapshot() ?? null
              : session.getSnapshot() ?? session.getCommittedSnapshot() ?? null;

          return buildContinuumVercelAiSdkRequestBody({
            body: {
              providerId: settings.providerId,
              model: settings.resolvedModel,
            },
            currentView: requestSnapshot?.view ?? initialVercelAiSdkView,
            currentData: requestSnapshot?.data.values ?? null,
          });
        },
      }),
    [
      session,
      settings.hasUsableBrowserKey,
      settings.providerId,
      settings.resolvedModel,
      settings.trimmedApiKey,
      streaming.activeStream,
    ]
  );

  const chatRuntimeKey = [
    settings.providerId,
    settings.resolvedModel,
    settings.trimmedApiKey,
  ].join(':');

  const previewStatusText =
    streaming.activeStream?.latestStatus?.status ??
    (isGenerating || streaming.isStreaming
      ? 'Streaming through the Vercel AI SDK while Continuum preserves matching form state.'
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
        previewFrameRef={previewFrameRef}
        previewStatusText={previewStatusText}
        isGenerating={isGenerating}
        renderedView={liveView}
        snapshotOverride={null}
        renderScope={undefined}
      />
    </div>
  );
}
