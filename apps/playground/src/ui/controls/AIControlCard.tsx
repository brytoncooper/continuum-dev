import { useState as useLocalState } from 'react';
import type { Checkpoint } from '@continuum/contract';
import type { ProviderId, AIConversationEntry, AIAttachment } from '../../ai/types';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

export interface ProviderOption {
  id: ProviderId;
  name: string;
  models: string[];
}

interface AIControlCardProps {
  providers: ProviderOption[];
  selectedProvider: ProviderId;
  selectedModel: string;
  apiKey: string;
  prompt: string;
  autoFeedback: boolean;
  entries: AIConversationEntry[];
  isLoading: boolean;
  attachments?: AIAttachment[];
  onProviderChange: (provider: ProviderId) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  onPromptChange: (prompt: string) => void;
  onAutoFeedbackChange: (enabled: boolean) => void;
  onAttachmentsChange?: (attachments: AIAttachment[]) => void;
  onSubmit: () => void;
  onClearSession?: () => void;
  onExportDebugLog?: () => string;
  checkpoints?: Checkpoint[];
  onRewind?: (checkpointId: string) => void;
  onCreateCheckpoint?: () => void;
  hasSuggestions?: boolean;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function AIControlCard({
  providers,
  selectedProvider,
  selectedModel,
  apiKey,
  prompt,
  autoFeedback,
  entries,
  isLoading,
  attachments = [],
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onPromptChange,
  onAutoFeedbackChange,
  onAttachmentsChange,
  onSubmit,
  onClearSession,
  onExportDebugLog,
  checkpoints,
  onRewind,
  onCreateCheckpoint,
  hasSuggestions,
  onAcceptAll,
  onRejectAll,
}: AIControlCardProps) {
  const [copied, setCopied] = useLocalState(false);
  const activeProvider =
    providers.find((provider) => provider.id === selectedProvider) ?? providers[0] ?? null;
  const latestCheckpoint = checkpoints && checkpoints.length > 0
    ? checkpoints[checkpoints.length - 1]
    : null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !onAttachmentsChange) return;

    const nextAttachments: AIAttachment[] = [...attachments];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      nextAttachments.push({
        name: file.name,
        mimeType: file.type,
        base64,
      });
    }

    onAttachmentsChange(nextAttachments);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    if (!onAttachmentsChange) return;
    const next = [...attachments];
    next.splice(index, 1);
    onAttachmentsChange(next);
  };

  return (
    <div
      style={{
        padding: space.xl,
        background: `linear-gradient(160deg, ${playgroundTheme.color.surface} 0%, rgba(247, 245, 255, 0.96) 60%, rgba(240, 252, 249, 0.95) 100%)`,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.panelBorder}`,
        boxShadow: `${playgroundTheme.shadow.card}, inset 0 0 0 1px ${playgroundTheme.color.borderGlow}`,
        display: 'grid',
        gap: space.sectionGap,
      }}
    >
      <div style={{ ...typeScale.overline, color: playgroundTheme.color.soft, textTransform: 'uppercase' }}>
        AI Playground
      </div>

      <div style={{ display: 'grid', gap: space.stackGap }}>
        <label style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>Provider</span>
          <select
            value={selectedProvider}
            onChange={(event) => onProviderChange(event.target.value as ProviderId)}
            style={inputStyle}
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>Model</span>
          <select
            value={selectedModel}
            onChange={(event) => onModelChange(event.target.value)}
            style={inputStyle}
          >
            {(activeProvider?.models ?? []).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>API Key</span>
          <input
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            type="password"
            placeholder="Enter provider API key"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>Prompt</span>
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Generate a loan application with personal details, employment, and submit action."
            style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
          />
        </label>

        <div style={{ display: 'grid', gap: space.xs }}>
          <span style={{ ...typeScale.caption, color: playgroundTheme.color.muted }}>Attachments (Image/PDF)</span>
          <div style={{ display: 'flex', gap: space.sm, flexWrap: 'wrap' }}>
            {attachments.map((att, i) => (
              <div
                key={`${att.name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space.xs,
                  padding: `4px ${space.sm}px`,
                  background: playgroundTheme.color.surfaceAlt,
                  border: `1px solid ${playgroundTheme.color.border}`,
                  borderRadius: radius.sm,
                  ...typeScale.caption,
                  fontSize: 11,
                }}
              >
                <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </span>
                <button
                  onClick={() => removeAttachment(i)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: playgroundTheme.color.danger,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: radius.sm,
                border: `1px dashed ${playgroundTheme.color.border}`,
                color: playgroundTheme.color.soft,
                cursor: 'pointer',
                fontSize: 20,
              }}
            >
              +
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: space.inlineGap, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: space.xs, ...typeScale.caption }}>
          <input
            type="checkbox"
            checked={autoFeedback}
            onChange={(event) => onAutoFeedbackChange(event.target.checked)}
          />
          Auto-feedback loop
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.inlineGap, flexWrap: 'wrap' }}>
          <button
            onClick={onSubmit}
            disabled={isLoading || !apiKey.trim() || !prompt.trim()}
            style={actionButtonStyle('primary', isLoading || !apiKey.trim() || !prompt.trim())}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
          {onClearSession && (
            <button
              onClick={onClearSession}
              disabled={isLoading}
              style={actionButtonStyle('dangerGhost', isLoading)}
            >
              Reset session
            </button>
          )}
          {hasSuggestions && (
            <>
              <button
                onClick={onAcceptAll}
                disabled={isLoading}
                style={actionButtonStyle('success', isLoading)}
              >
                Accept All
              </button>
              <button
                onClick={onRejectAll}
                disabled={isLoading}
                style={actionButtonStyle('secondary', isLoading)}
              >
                Reject All
              </button>
            </>
          )}
          {onExportDebugLog ? (
            <button
              onClick={() => {
                const json = onExportDebugLog();
                navigator.clipboard.writeText(json).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              style={actionButtonStyle('secondary', false)}
            >
              {copied ? 'Copied' : 'Export debug log'}
            </button>
          ) : null}
        </div>
      </div>

      {checkpoints && onRewind ? (
        <div
          style={{
            display: 'grid',
            gap: space.stackGap,
            padding: space.md,
            borderRadius: radius.md,
            border: `1px solid ${playgroundTheme.color.border}`,
            background: playgroundTheme.color.surfaceAlt,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted, textTransform: 'uppercase' }}>
                Checkpoint Timeline
              </div>
              <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                {checkpoints.length} checkpoint{checkpoints.length === 1 ? '' : 's'}
              </div>
            </div>
            {onCreateCheckpoint ? (
              <button
                onClick={onCreateCheckpoint}
                style={{
                  ...typeScale.caption,
                  borderRadius: radius.sm,
                  border: `1px solid ${playgroundTheme.color.accent}`,
                  background: playgroundTheme.color.accent,
                  color: playgroundTheme.color.white,
                  padding: `6px ${space.sm}px`,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Create checkpoint
              </button>
            ) : null}
          </div>
          {latestCheckpoint ? (
            <div
              style={{
                display: 'grid',
                gap: 2,
                padding: `${space.xs}px ${space.sm}px`,
                borderRadius: radius.sm,
                border: `1px solid ${playgroundTheme.color.borderStrong}`,
                background: playgroundTheme.color.surface,
              }}
            >
              <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                Latest: v{latestCheckpoint.snapshot.view.version}
              </div>
              <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontSize: 11 }}>
                {new Date(latestCheckpoint.timestamp).toLocaleString()} | {latestCheckpoint.trigger}
              </div>
            </div>
          ) : (
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>
              No checkpoints yet
            </div>
          )}
          {latestCheckpoint ? (
            <button
              onClick={() => onRewind(latestCheckpoint.checkpointId)}
              style={actionButtonStyle('secondary', false)}
            >
              Rewind to latest
            </button>
          ) : null}
          <details>
            <summary
              style={{
                ...typeScale.caption,
                color: playgroundTheme.color.soft,
                cursor: 'pointer',
              }}
            >
              Open timeline
            </summary>
            <div
              style={{
                marginTop: space.sm,
                maxHeight: 180,
                overflow: 'auto',
                display: 'grid',
                gap: space.xs,
                padding: space.xs,
                border: `1px solid ${playgroundTheme.color.border}`,
                borderRadius: radius.sm,
                background: playgroundTheme.color.surface,
              }}
            >
              {[...checkpoints].reverse().map((cp) => (
                <div
                  key={cp.checkpointId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.sm,
                    padding: `${space.sm}px ${space.sm}px`,
                    border: `1px solid ${playgroundTheme.color.border}`,
                    borderRadius: radius.sm,
                    background: playgroundTheme.color.surfaceAlt,
                  }}
                >
                  <div style={{ display: 'grid', gap: 2 }}>
                    <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                      v{cp.snapshot.view.version}
                    </span>
                    <span style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontSize: 10 }}>
                      {new Date(cp.timestamp).toLocaleTimeString()} | {cp.trigger}
                    </span>
                  </div>
                  <button
                    onClick={() => onRewind(cp.checkpointId)}
                    style={{
                      ...typeScale.caption,
                      borderRadius: radius.sm,
                      border: `1px solid ${playgroundTheme.color.accent}`,
                      background: 'transparent',
                      color: playgroundTheme.color.accent,
                      padding: `4px ${space.sm}px`,
                      cursor: 'pointer',
                      fontSize: 10,
                      textTransform: 'uppercase',
                    }}
                  >
                    Rewind
                  </button>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: space.stackGap }}>
        <div style={{ ...typeScale.overline, color: playgroundTheme.color.muted, textTransform: 'uppercase' }}>
          Run History
        </div>
        <div
          style={{
            maxHeight: 260,
            overflow: 'auto',
            display: 'grid',
            gap: space.xs,
            padding: space.sm,
            border: `1px solid ${playgroundTheme.color.border}`,
            borderRadius: radius.md,
            background: playgroundTheme.color.surfaceAlt,
          }}
        >
          {entries.length === 0 ? (
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>
              No runs yet. Generate your first view.
            </div>
          ) : (
            entries.map((entry) => {
              const hasError = Boolean(entry.requestError);
              const hasValidationErrors = Boolean(entry.validationErrors?.length);
              const isSuccess = !hasError && !hasValidationErrors && Boolean(entry.viewVersion);
              const statusLabel = hasError ? 'Failed' : hasValidationErrors ? 'Validation' : isSuccess ? 'Applied' : 'Pending';
              const statusColor = hasError
                ? playgroundTheme.color.danger
                : hasValidationErrors
                  ? playgroundTheme.color.warning
                  : isSuccess
                    ? playgroundTheme.color.success
                    : playgroundTheme.color.soft;

              return (
                <details
                  key={entry.id}
                  style={{
                    border: `1px solid ${statusColor}22`,
                    borderLeft: `3px solid ${statusColor}`,
                    borderRadius: radius.sm,
                    padding: `${space.xs}px ${space.sm}px`,
                    background: playgroundTheme.color.surface,
                  }}
                >
                  <summary style={{ cursor: 'pointer', ...typeScale.caption, color: playgroundTheme.color.text, display: 'flex', alignItems: 'center', gap: space.xs }}>
                    <span style={{ flex: 1 }}>
                      {new Date(entry.createdAt).toLocaleTimeString()} | {entry.provider}/{entry.model}
                    </span>
                    <span
                      style={{
                        ...typeScale.caption,
                        fontSize: 10,
                        color: statusColor,
                        border: `1px solid ${statusColor}55`,
                        borderRadius: radius.pill,
                        padding: '1px 6px',
                      }}
                    >
                      {statusLabel}
                    </span>
                  </summary>
                  <div style={{ marginTop: space.sm, display: 'grid', gap: space.xs }}>
                    <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontStyle: 'italic' }}>
                      "{entry.prompt}"
                    </div>

                    {entry.attachments && entry.attachments.length > 0 ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                        📎 {entry.attachments.map(a => a.name).join(', ')}
                      </div>
                    ) : null}

                    {isSuccess ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.success, padding: `${space.xs}px ${space.sm}px`, background: playgroundTheme.color.successBg, borderRadius: radius.sm }}>
                        ✅ Applied view version {entry.viewVersion}
                        {entry.resolutions ? ` · ${entry.resolutions.length} node${entry.resolutions.length !== 1 ? 's' : ''} resolved` : ''}
                      </div>
                    ) : null}

                    {entry.requestError ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.danger, padding: `${space.xs}px ${space.sm}px`, background: playgroundTheme.color.dangerBg, borderRadius: radius.sm }}>
                        ❌ {entry.requestError}
                      </div>
                    ) : null}

                    {hasValidationErrors ? (
                      <div style={{ display: 'grid', gap: 2, padding: `${space.xs}px ${space.sm}px`, background: playgroundTheme.color.warningBg, borderRadius: radius.sm }}>
                        <div style={{ ...typeScale.caption, color: playgroundTheme.color.warning, fontWeight: 600 }}>
                          ⚠️ {entry.validationErrors!.length} validation error{entry.validationErrors!.length > 1 ? 's' : ''} — view was NOT applied
                        </div>
                        {entry.validationErrors!.map((err, i) => (
                          <div key={i} style={{ ...typeScale.caption, color: playgroundTheme.color.warning, fontSize: 11, paddingLeft: space.md }}>
                            • {err}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {entry.rawResponse ? (
                      <details style={{ marginTop: space.xs }}>
                        <summary style={{ ...typeScale.caption, color: playgroundTheme.color.soft, cursor: 'pointer', fontSize: 11 }}>
                          Show raw AI response
                        </summary>
                        <pre
                          style={{
                            margin: 0,
                            marginTop: space.xs,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            ...typeScale.caption,
                            color: playgroundTheme.color.muted,
                            fontSize: 11,
                            maxHeight: 200,
                            overflow: 'auto',
                            padding: space.sm,
                            background: playgroundTheme.color.surfaceMuted,
                            borderRadius: radius.sm,
                          }}
                        >
                          {entry.rawResponse}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}

const inputStyle = {
  width: '100%',
  borderRadius: radius.sm,
  border: `1px solid ${playgroundTheme.color.border}`,
  padding: `${space.sm}px ${space.md}px`,
  background: playgroundTheme.color.surface,
  color: playgroundTheme.color.text,
  ...typeScale.body,
} as const;

const buttonStyle = {
  borderRadius: radius.sm,
  border: `1px solid ${playgroundTheme.color.accent}`,
  background: playgroundTheme.color.accent,
  color: playgroundTheme.color.white,
  padding: `${space.sm}px ${space.lg}px`,
  cursor: 'pointer',
  ...typeScale.caption,
  textTransform: 'uppercase',
} as const;

function actionButtonStyle(
  variant: 'primary' | 'secondary' | 'success' | 'dangerGhost',
  disabled: boolean
) {
  const shared = {
    ...buttonStyle,
    opacity: disabled ? 0.65 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  if (variant === 'primary') {
    return shared;
  }
  if (variant === 'success') {
    return {
      ...shared,
      background: playgroundTheme.color.success,
      borderColor: playgroundTheme.color.success,
    };
  }
  if (variant === 'dangerGhost') {
    return {
      ...shared,
      background: disabled ? playgroundTheme.color.disabledBg : 'transparent',
      color: disabled ? playgroundTheme.color.disabledText : playgroundTheme.color.danger,
      borderColor: playgroundTheme.color.danger,
    };
  }
  return {
    ...shared,
    background: disabled ? playgroundTheme.color.disabledBg : 'transparent',
    color: disabled ? playgroundTheme.color.disabledText : playgroundTheme.color.text,
    borderColor: playgroundTheme.color.borderStrong,
  };
}
