import {
  StarterKitChatBox,
  StarterKitSessionWorkbench,
  type ContinuumVercelAiSdkMessage,
} from '@continuum-dev/starter-kit-ai';
import type { DefaultChatTransport } from 'ai';
import type { ViewDefinition } from '@continuum-dev/core';
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

const modeRowStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: space.sm,
} as const;

const modeButtonStyle = {
  boxSizing: 'border-box' as const,
  height: control.height,
  padding: `0 ${space.lg}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
  ...type.body,
  fontWeight: 600,
} as const;

const helperTextStyle = {
  ...type.small,
  color: color.textMuted,
} as const;

const inlineNoteStyle = {
  ...helperTextStyle,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
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

export interface VercelAiSdkControlsPanelProps {
  initialView: ViewDefinition;
  isMobile: boolean;
  settings: UseVercelAiSdkDemoSettingsResult;
  chatRuntimeKey: string;
  transport: DefaultChatTransport<ContinuumVercelAiSdkMessage>;
  onSubmittingChange(isSubmitting: boolean): void;
  onError(error: Error): void;
}

export function VercelAiSdkControlsPanel({
  initialView,
  isMobile,
  settings,
  chatRuntimeKey,
  transport,
  onSubmittingChange,
  onError,
}: VercelAiSdkControlsPanelProps) {
  return (
    <aside style={panelStyle}>
      <div style={{ ...type.section, color: color.text }}>
        Starter-kit first
      </div>
      <div style={helperTextStyle}>
        The wrapper is deliberately thin: starter-kit owns the preset UI and
        session tools, while Vercel AI SDK keeps handling transport and
        streaming.
      </div>

      <div style={controlCardStyle}>
        <div style={{ ...type.label, color: color.textSoft }}>
          Transport mode
        </div>
        <div style={modeRowStyle}>
          <button
            type="button"
            onClick={() => {
              settings.setMode('mock');
            }}
            aria-pressed={settings.mode === 'mock'}
            style={{
              ...modeButtonStyle,
              background:
                settings.mode === 'mock' ? color.accent : modeButtonStyle.background,
              color:
                settings.mode === 'mock' ? color.surface : modeButtonStyle.color,
              border:
                settings.mode === 'mock'
                  ? `1px solid ${color.borderStrong}`
                  : modeButtonStyle.border,
            }}
          >
            Mock demo
          </button>
          <button
            type="button"
            onClick={() => {
              settings.setMode('live');
            }}
            aria-pressed={settings.mode === 'live'}
            style={{
              ...modeButtonStyle,
              background:
                settings.mode === 'live' ? color.accent : modeButtonStyle.background,
              color:
                settings.mode === 'live' ? color.surface : modeButtonStyle.color,
              border:
                settings.mode === 'live'
                  ? `1px solid ${color.borderStrong}`
                  : modeButtonStyle.border,
            }}
          >
            Live BYOK
          </button>
        </div>

        {settings.mode === 'live' ? (
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
              <span style={fieldLabelStyle}>
                {settings.selectedProvider.tokenLabel}
              </span>
              <input
                type="password"
                value={settings.activeApiKey}
                onChange={(event) => {
                  settings.setApiKey(event.target.value);
                }}
                placeholder={
                  settings.selectedProvider.serverKeyAvailable
                    ? 'Optional override'
                    : 'Paste key'
                }
                style={{
                  ...inputStyle,
                  border:
                    settings.apiKeyValidationMessage && settings.mode === 'live'
                      ? '1px solid #c25b56'
                      : inputStyle.border,
                }}
              />
            </label>

            <label style={controlGroupStyle}>
              <span style={fieldLabelStyle}>Model</span>
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
            </label>
          </div>
        ) : null}

        <div style={inlineNoteStyle}>{settings.liveStatusText}</div>
      </div>

      <StarterKitSessionWorkbench
        initialView={initialView}
        resetLabel="Reset session"
      />

      <div style={chatLockWrapperStyle}>
        <StarterKitChatBox
          key={chatRuntimeKey}
          driver={{
            kind: 'vercel-ai-sdk',
            props: {
              chatOptions: {
                transport,
              },
              instructionPlaceholder:
                settings.mode === 'live'
                  ? 'Try: turn this into a business lead form with company, budget, and timeline.'
                  : 'Try: make this mobile-first and add a household members section.',
              onError,
              onSubmittingChange,
            },
          }}
        />
        {settings.isChatLocked ? (
          <div style={chatLockOverlayStyle}>
            <div style={chatLockCardStyle}>
              <div style={{ ...type.section, color: color.text }}>
                Live chat locked
              </div>
              <div style={helperTextStyle}>
                Add a provider key above to unlock real Vercel AI SDK requests.
                Mock mode is still available if you just want to inspect the
                Continuum session flow.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
