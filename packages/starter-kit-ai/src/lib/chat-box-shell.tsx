import { useRef, type ReactNode } from 'react';
import {
  color,
  control,
  radius,
  space,
  type as typography,
} from '@continuum-dev/starter-kit';

export interface StarterKitChatBoxShellProps {
  title?: string;
  description?: string;
  providerControl?: ReactNode;
  instructionLabel: string;
  instructionPlaceholder: string;
  submitLabel: string;
  instruction: string;
  isSubmitting: boolean;
  submitDisabled?: boolean;
  status: string | null;
  errorText: string | null;
  copiedPrompt: string | null;
  enableSuggestedPrompts?: boolean;
  suggestedPrompts?: string[];
  attachmentFiles: File[];
  addAttachmentFiles(files: FileList | null): void;
  removeAttachmentAt(index: number): void;
  setInstruction(instruction: string): void;
  submit(): Promise<void>;
  copyPrompt(prompt: string): void;
}

export function StarterKitChatBoxShell({
  title,
  description,
  providerControl,
  instructionLabel,
  instructionPlaceholder,
  submitLabel,
  instruction,
  isSubmitting,
  submitDisabled = false,
  status,
  errorText,
  copiedPrompt,
  enableSuggestedPrompts = false,
  suggestedPrompts,
  attachmentFiles,
  addAttachmentFiles,
  removeAttachmentAt,
  setInstruction,
  submit,
  copyPrompt,
}: StarterKitChatBoxShellProps) {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const canSubmit = Boolean(instruction.trim()) || attachmentFiles.length > 0;

  return (
    <section
      style={{
        display: 'grid',
        gap: space.md,
        padding: space.lg,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        background: color.surface,
        alignContent: 'start',
      }}
    >
      {title || description ? (
        <div style={{ display: 'grid', gap: space.xs }}>
          {title ? (
            <div style={{ ...typography.section, color: color.text }}>
              {title}
            </div>
          ) : null}
          {description ? (
            <div style={{ ...typography.small, color: color.textMuted }}>
              {description}
            </div>
          ) : null}
        </div>
      ) : null}

      {providerControl}

      <label style={{ display: 'grid', gap: space.xs }}>
        <span style={{ ...typography.label, color: color.textSoft }}>
          {instructionLabel}
        </span>
        <textarea
          value={instruction}
          onChange={(event) => {
            setInstruction(event.target.value);
          }}
          placeholder={instructionPlaceholder}
          rows={5}
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: 120,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            padding: `${space.sm}px ${space.md}px`,
            resize: 'vertical',
            ...typography.body,
          }}
        />
      </label>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: space.sm,
        }}
      >
        <input
          ref={attachmentInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(event) => {
            addAttachmentFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => {
            attachmentInputRef.current?.click();
          }}
          disabled={isSubmitting}
          style={{
            boxSizing: 'border-box',
            height: control.height,
            padding: `0 ${space.md}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            background: color.surfaceMuted,
            color: color.text,
            cursor: isSubmitting ? 'wait' : 'pointer',
            ...typography.small,
            fontWeight: 600,
          }}
        >
          Attach file
        </button>
        {attachmentFiles.map((file, index) => (
          <span
            key={`${file.name}-${String(index)}-${file.lastModified}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: space.xs,
              padding: `${space.xs}px ${space.sm}px`,
              borderRadius: radius.md,
              border: `1px solid ${color.borderSoft}`,
              ...typography.small,
              color: color.text,
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => {
                removeAttachmentAt(index);
              }}
              disabled={isSubmitting}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                padding: 0,
                color: color.textMuted,
                ...typography.small,
                lineHeight: 1,
              }}
              aria-label={`Remove ${file.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: space.sm,
        }}
      >
        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={isSubmitting || submitDisabled || !canSubmit}
          style={{
            boxSizing: 'border-box',
            height: control.height,
            padding: `0 ${space.lg}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            background: color.accent,
            color: color.surface,
            cursor: isSubmitting
              ? 'wait'
              : submitDisabled
              ? 'not-allowed'
              : 'pointer',
            opacity: submitDisabled ? 0.6 : 1,
            ...typography.body,
            fontWeight: 600,
          }}
        >
          {isSubmitting ? 'Running...' : submitLabel}
        </button>
      </div>

      {status ? (
        <div style={{ ...typography.small, color: color.textMuted }}>
          {status}
        </div>
      ) : null}
      {errorText ? (
        <div style={{ ...typography.small, color: '#a91b0d' }}>{errorText}</div>
      ) : null}

      {enableSuggestedPrompts &&
      suggestedPrompts &&
      suggestedPrompts.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: space.sm,
            paddingTop: space.sm,
            borderTop: `1px solid ${color.borderSoft}`,
          }}
        >
          <span style={{ ...typography.label, color: color.textSoft }}>
            Suggested prompts
          </span>
          {suggestedPrompts.map((prompt) => (
            <div
              key={prompt}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: space.sm,
                padding: `${space.sm}px ${space.md}px`,
                borderRadius: radius.md,
                border: `1px solid ${color.borderSoft}`,
                background: color.surfaceMuted,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setInstruction(prompt);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: 0,
                  ...typography.small,
                  color: color.text,
                }}
              >
                {prompt}
              </button>
              <button
                type="button"
                onClick={() => {
                  copyPrompt(prompt);
                }}
                style={{
                  boxSizing: 'border-box',
                  height: 32,
                  padding: `0 ${space.md}px`,
                  borderRadius: radius.md,
                  border: `1px solid ${color.border}`,
                  background: color.surface,
                  color: color.text,
                  cursor: 'pointer',
                  ...typography.small,
                  fontWeight: 600,
                }}
              >
                {copiedPrompt === prompt ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
