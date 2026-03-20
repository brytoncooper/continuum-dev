import type { ReactNode } from 'react';
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
  setInstruction,
  submit,
  copyPrompt,
}: StarterKitChatBoxShellProps) {
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
          disabled={isSubmitting || submitDisabled || !instruction.trim()}
          style={{
            boxSizing: 'border-box',
            height: control.height,
            padding: `0 ${space.lg}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.borderStrong}`,
            background: color.accent,
            color: color.surface,
            cursor: isSubmitting ? 'wait' : submitDisabled ? 'not-allowed' : 'pointer',
            opacity: submitDisabled ? 0.6 : 1,
            ...typography.body,
            fontWeight: 600,
          }}
        >
          {isSubmitting ? 'Running...' : submitLabel}
        </button>
      </div>

      {status ? (
        <div style={{ ...typography.small, color: color.textMuted }}>{status}</div>
      ) : null}
      {errorText ? (
        <div style={{ ...typography.small, color: '#a91b0d' }}>{errorText}</div>
      ) : null}

      {enableSuggestedPrompts && suggestedPrompts && suggestedPrompts.length > 0 ? (
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
