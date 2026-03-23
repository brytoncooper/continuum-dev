import {
  StarterKitChatBox,
  StarterKitSessionWorkbench,
  type ContinuumVercelAiSdkMessage,
} from '@continuum-dev/starter-kit-ai';
import { isContinuumVercelAiSdkDataPart } from '@continuum-dev/vercel-ai-sdk-adapter';
import type { ChatOnDataCallback, DefaultChatTransport } from 'ai';
import type { ViewDefinition } from '@continuum-dev/core';
import { useCallback, useState } from 'react';
import { color, control, radius, space, type } from '../../ui/tokens';
import type { UseVercelAiSdkDemoSettingsResult } from '../hooks/use-vercel-ai-sdk-demo-settings';

const panelStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
} as const;

const controlCardStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
} as const;

const controlGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
} as const;

const controlGroupStyle = {
  display: 'grid',
  gap: space.xs,
} as const;

const fieldLabelStyle = {
  ...type.label,
  color: color.textSoft,
} as const;

const inputStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  height: control.height,
  padding: `0 ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  ...type.body,
} as const;

const staticValueStyle = {
  ...inputStyle,
  display: 'flex',
  alignItems: 'center',
} as const;

const helperTextStyle = {
  ...type.small,
  color: color.textMuted,
} as const;

const chatLockWrapperStyle = {
  position: 'relative' as const,
  display: 'grid',
} as const;

const chatLockOverlayStyle = {
  position: 'absolute' as const,
  inset: 0,
  display: 'grid',
  alignItems: 'center',
  padding: space.lg,
  borderRadius: radius.lg,
  background: 'rgba(248, 248, 246, 0.82)',
  backdropFilter: 'blur(2px)',
} as const;

const chatLockCardStyle = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  boxShadow: '0 12px 28px rgba(19, 19, 18, 0.08)',
} as const;

const workbenchWrapStyle = {
  display: 'grid',
} as const;

export interface VercelAiSdkControlsPanelProps {
  initialView: ViewDefinition;
  isMobile: boolean;
  settings: UseVercelAiSdkDemoSettingsResult;
  chatRuntimeKey: string;
  transport: DefaultChatTransport<ContinuumVercelAiSdkMessage>;
  debugEcho: boolean;
  onDebugEchoChange(value: boolean): void;
  onSubmittingChange(isSubmitting: boolean): void;
  onError(error: Error): void;
}

export function VercelAiSdkControlsPanel({
  initialView,
  isMobile,
  settings,
  chatRuntimeKey,
  transport,
  debugEcho,
  onDebugEchoChange,
  onSubmittingChange,
  onError,
}: VercelAiSdkControlsPanelProps) {
  const [vercelAiSdkChatRemountSerial, setVercelAiSdkChatRemountSerial] =
    useState(0);
  const remountVercelAiSdkChatToClearTranscript = useCallback(() => {
    setVercelAiSdkChatRemountSerial((serial) => serial + 1);
  }, []);

  const handleChatData = useCallback<
    ChatOnDataCallback<ContinuumVercelAiSdkMessage>
  >((part) => {
    if (!isContinuumVercelAiSdkDataPart(part)) {
      return;
    }
    if (part.type !== 'data-continuum-execution-trace') {
      return;
    }
    console.groupCollapsed('[vercel-ai-sdk-demo] Continuum execution trace');
    console.log('instruction:', part.data.instruction);
    console.log('result:', part.data.result);
    console.log('trace (LLM phases):', part.data.trace);
    console.groupEnd();
  }, []);

  return (
    <aside style={panelStyle}>
      <div style={{ display: 'grid', gap: space.xs }}>
        <div style={{ ...type.section, color: color.text }}>
          Add stable Continuum state to Vercel AI SDK
        </div>
        <div style={helperTextStyle}>
          Keep your existing route and transport. Continuum preserves
          user-entered state while streamed UI changes land.
        </div>
      </div>

      <div style={controlCardStyle}>
        <div style={{ ...type.label, color: color.textSoft }}>Provider</div>
        <label style={controlGroupStyle}>
          <span style={fieldLabelStyle}>
            {settings.selectedProvider.tokenLabel}
          </span>
          <input
            type="password"
            value={settings.activeApiKey}
            onChange={(event) => {
              settings.setApiKey(event.target.value);
            }}
            placeholder="Paste key"
            style={{
              ...inputStyle,
              border: settings.apiKeyValidationMessage
                ? '1px solid #c25b56'
                : inputStyle.border,
            }}
          />
        </label>
        <div
          style={{
            ...controlGridStyle,
            gridTemplateColumns: isMobile
              ? 'minmax(0, 1fr)'
              : controlGridStyle.gridTemplateColumns,
          }}
        >
          <label style={controlGroupStyle}>
            <span style={fieldLabelStyle}>Provider</span>
            <select
              value={settings.providerId}
              onChange={(event) => {
                settings.setProviderId(
                  event.target.value as typeof settings.providerId
                );
              }}
              style={inputStyle}
            >
              {settings.providerCatalog.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label style={controlGroupStyle}>
            <span style={fieldLabelStyle}>Model</span>
            {settings.providerId === 'openai' ? (
              <div style={staticValueStyle}>GPT-5.4</div>
            ) : (
              <select
                value={settings.selectedModel}
                onChange={(event) => {
                  settings.setModel(event.target.value);
                }}
                style={inputStyle}
              >
                <option value="">
                  Provider default ({settings.selectedProvider.defaultModel})
                </option>
                {settings.selectedProvider.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: space.sm,
          padding: space.md,
          borderRadius: radius.md,
          border: `1px solid ${color.borderSoft}`,
          background: color.surfaceMuted,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={debugEcho}
          onChange={(event) => {
            onDebugEchoChange(event.target.checked);
          }}
          style={{ marginTop: 2 }}
        />
        <span style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...type.body, color: color.text, fontWeight: 600 }}>
            Debug: what the model sees
          </span>
          <span style={helperTextStyle}>
            Stream a normal assistant reply that describes your text and
            attachments (no Continuum view generation). Uses the same provider
            and model as above. Choose PDFs or images in the file picker, then
            send in the same action as your message so the request includes file
            parts; toggling this checkbox no longer resets the chat.
          </span>
        </span>
      </label>

      <div style={chatLockWrapperStyle}>
        <StarterKitChatBox
          key={`${chatRuntimeKey}:${vercelAiSdkChatRemountSerial}`}
          driver={{
            kind: 'vercel-ai-sdk',
            props: {
              chatOptions: {
                transport,
                onData: handleChatData,
              },
              title: debugEcho ? 'Multimodal debug' : 'Try a UI change request',
              description: debugEcho
                ? 'Pick files below, then send with your question so the body includes file parts. The reply is plain streamed text only.'
                : 'Send one prompt through the Vercel AI SDK stream. Continuum keeps matching fields stable when the form changes.',
              instructionLabel: debugEcho ? 'Message' : 'Request',
              instructionPlaceholder: debugEcho
                ? 'What do you see in my last message and attachments?'
                : 'Add company size, budget, and timeline without losing what I already typed.',
              submitLabel: debugEcho ? 'Send debug' : 'Apply change',
              onError,
              onSubmittingChange,
            },
          }}
        />
        {settings.isChatLocked ? (
          <div style={chatLockOverlayStyle}>
            <div style={chatLockCardStyle}>
              <div style={{ ...type.section, color: color.text }}>
                Add a key to continue
              </div>
              <div style={helperTextStyle}>
                Paste your provider key above to enable live requests. Continuum
                stays in the same Vercel AI SDK flow you already use.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={workbenchWrapStyle}>
        <style>
          {`[data-vercel-workbench] > div:first-child > span {
            display: none;
          }`}
        </style>
        <div data-vercel-workbench>
          <StarterKitSessionWorkbench
            initialView={initialView}
            resetLabel="Form Reset"
            onAfterSessionReset={remountVercelAiSdkChatToClearTranscript}
          />
        </div>
      </div>
    </aside>
  );
}
