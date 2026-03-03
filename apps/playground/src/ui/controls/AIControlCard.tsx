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
  pipelineMode?: boolean;
  pipelineStage?: string | null;
  patchMode?: boolean;
  hasCurrentView?: boolean;
  entries: AIConversationEntry[];
  isLoading: boolean;
  attachments?: AIAttachment[];
  onProviderChange: (provider: ProviderId) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (apiKey: string) => void;
  onPromptChange: (prompt: string) => void;
  onAutoFeedbackChange: (enabled: boolean) => void;
  onPipelineModeChange?: (enabled: boolean) => void;
  onPatchModeChange?: (enabled: boolean) => void;
  onAttachmentsChange?: (attachments: AIAttachment[]) => void;
  onSubmit: () => void;
  onClearSession?: () => void;
  onExportDebugLog?: () => string;
  checkpoints?: Checkpoint[];
  onRewind?: (checkpointId: string) => void;
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
  pipelineMode,
  pipelineStage,
  patchMode,
  hasCurrentView,
  entries,
  isLoading,
  attachments = [],
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onPromptChange,
  onAutoFeedbackChange,
  onPipelineModeChange,
  onPatchModeChange,
  onAttachmentsChange,
  onSubmit,
  onClearSession,
  onExportDebugLog,
  checkpoints,
  onRewind,
  hasSuggestions,
  onAcceptAll,
  onRejectAll,
}: AIControlCardProps) {
  const [copied, setCopied] = useLocalState(false);
  const activeProvider =
    providers.find((provider) => provider.id === selectedProvider) ?? providers[0] ?? null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !onAttachmentsChange) return;

    const nextAttachments: AIAttachment[] = [...attachments];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Strip data: prefix
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
    e.target.value = ''; // Reset input
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
        gap: space.lg,
      }}
    >
      <div style={{ ...typeScale.label, color: playgroundTheme.color.soft, textTransform: 'uppercase' }}>
        Live AI Session
      </div>

      <div style={{ display: 'grid', gap: space.md }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: space.xs, ...typeScale.caption }}>
          <input
            type="checkbox"
            checked={autoFeedback}
            onChange={(event) => onAutoFeedbackChange(event.target.checked)}
          />
          Auto-feedback loop
        </label>
        {onPipelineModeChange && (
          <label style={{ display: 'flex', alignItems: 'center', gap: space.xs, ...typeScale.caption }}>
            <input
              type="checkbox"
              checked={pipelineMode ?? false}
              onChange={(event) => onPipelineModeChange(event.target.checked)}
            />
            Pipeline Mode
          </label>
        )}
        {onPatchModeChange && hasCurrentView && (
          <label style={{ display: 'flex', alignItems: 'center', gap: space.xs, ...typeScale.caption }}>
            <input
              type="checkbox"
              checked={patchMode ?? false}
              onChange={(event) => onPatchModeChange(event.target.checked)}
            />
            Patch Mode
          </label>
        )}
        <button onClick={onSubmit} disabled={isLoading || !apiKey.trim() || !prompt.trim()} style={buttonStyle}>
          {isLoading ? (pipelineStage ? `Stage: ${pipelineStage}...` : 'Generating...') : 'Generate View'}
        </button>
        {onClearSession && (
          <button
            onClick={onClearSession}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              background: 'transparent',
              color: playgroundTheme.color.danger,
              border: `1px solid ${playgroundTheme.color.danger}`,
            }}
          >
            Clear Session
          </button>
        )}
        {hasSuggestions && (
          <>
            <button
              onClick={onAcceptAll}
              disabled={isLoading}
              style={{
                ...buttonStyle,
                background: playgroundTheme.color.success,
                borderColor: playgroundTheme.color.success,
              }}
            >
              Accept All
            </button>
            <button
              onClick={onRejectAll}
              disabled={isLoading}
              style={{
                ...buttonStyle,
                background: 'transparent',
                color: playgroundTheme.color.text,
                borderColor: playgroundTheme.color.border,
              }}
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
            style={{
              ...buttonStyle,
              background: 'transparent',
              color: playgroundTheme.color.soft,
              border: `1px solid ${playgroundTheme.color.border}`,
            }}
          >
            {copied ? '✓ Copied!' : 'Copy Debug Log'}
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: space.sm }}>
        <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted, textTransform: 'uppercase' }}>
          Conversation
        </div>
        <div
          style={{
            maxHeight: 260,
            overflow: 'auto',
            display: 'grid',
            gap: space.sm,
            padding: space.sm,
            border: `1px solid ${playgroundTheme.color.border}`,
            borderRadius: radius.md,
            background: playgroundTheme.color.surfaceAlt,
          }}
        >
          {entries.length === 0 ? (
            <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft }}>
              No prompts yet. Send your first request.
            </div>
          ) : (
            entries.map((entry) => {
              const hasError = Boolean(entry.requestError);
              const hasValidationErrors = Boolean(entry.validationErrors?.length);
              const isSuccess = !hasError && !hasValidationErrors && Boolean(entry.viewVersion);
              const statusIcon = hasError ? '❌' : hasValidationErrors ? '⚠️' : isSuccess ? '✅' : '⏳';
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
                    padding: space.sm,
                    background: playgroundTheme.color.surface,
                  }}
                >
                  <summary style={{ cursor: 'pointer', ...typeScale.caption, color: playgroundTheme.color.text, display: 'flex', alignItems: 'center', gap: space.xs }}>
                    <span>{statusIcon}</span>
                    <span style={{ flex: 1 }}>
                      {new Date(entry.createdAt).toLocaleTimeString()} — {entry.provider}/{entry.model}
                    </span>
                    <span style={{ ...typeScale.caption, fontSize: 11, color: statusColor }}>
                      {hasError
                        ? 'Failed'
                        : hasValidationErrors
                          ? `${entry.validationErrors!.length} error${entry.validationErrors!.length > 1 ? 's' : ''}`
                          : isSuccess
                            ? `v${entry.viewVersion}`
                            : 'Pending'}
                    </span>
                  </summary>
                  <div style={{ marginTop: space.sm, display: 'grid', gap: space.xs }}>
                    {/* Prompt */}
                    <div style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontStyle: 'italic' }}>
                      "{entry.prompt}"
                    </div>

                    {/* Attachments */}
                    {entry.attachments && entry.attachments.length > 0 ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                        📎 {entry.attachments.map(a => a.name).join(', ')}
                      </div>
                    ) : null}

                    {/* Verdict line */}
                    {isSuccess ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.success, padding: `${space.xs}px ${space.sm}px`, background: playgroundTheme.color.successBg, borderRadius: radius.sm }}>
                        ✅ Applied view version {entry.viewVersion}
                        {entry.resolutions ? ` · ${entry.resolutions.length} node${entry.resolutions.length !== 1 ? 's' : ''} resolved` : ''}
                      </div>
                    ) : null}

                    {/* Request error */}
                    {entry.requestError ? (
                      <div style={{ ...typeScale.caption, color: playgroundTheme.color.danger, padding: `${space.xs}px ${space.sm}px`, background: playgroundTheme.color.dangerBg, borderRadius: radius.sm }}>
                        ❌ {entry.requestError}
                      </div>
                    ) : null}

                    {/* Validation errors — structured */}
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

                    {/* Raw response (collapsible) */}
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

      {checkpoints && checkpoints.length > 0 && onRewind ? (
        <div style={{ display: 'grid', gap: space.sm }}>
          <div style={{ ...typeScale.caption, color: playgroundTheme.color.muted, textTransform: 'uppercase' }}>
            Checkpoints ({checkpoints.length})
          </div>
          <div
            style={{
              maxHeight: 180,
              overflow: 'auto',
              display: 'grid',
              gap: space.xs,
              padding: space.sm,
              border: `1px solid ${playgroundTheme.color.border}`,
              borderRadius: radius.md,
              background: playgroundTheme.color.surfaceAlt,
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
                  padding: `${space.xs}px ${space.sm}px`,
                  border: `1px solid ${playgroundTheme.color.border}`,
                  borderRadius: radius.sm,
                  background: playgroundTheme.color.surface,
                }}
              >
                <div style={{ display: 'grid', gap: 2 }}>
                  <span style={{ ...typeScale.caption, color: playgroundTheme.color.text }}>
                    {new Date(cp.timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontSize: 10 }}>
                    v{cp.snapshot.view.version} — {cp.trigger}
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
                    padding: `2px ${space.sm}px`,
                    cursor: 'pointer',
                    fontSize: 10,
                    textTransform: 'uppercase',
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
