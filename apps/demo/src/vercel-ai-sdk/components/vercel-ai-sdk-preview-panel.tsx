import type { ContinuitySnapshot, ViewDefinition } from '@continuum-dev/core';
import { ContinuumRenderer } from '@continuum-dev/starter-kit';
import type { MutableRefObject } from 'react';
import { color, radius, space, type } from '../../ui/tokens';

const panelStyle = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
} as const;

const previewFrameStyle = {
  position: 'relative' as const,
  display: 'grid',
  gap: space.lg,
  padding: space.xl,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,248,246,0.85) 100%)',
} as const;

const helperTextStyle = {
  ...type.small,
  color: color.textMuted,
} as const;

const previewNoteStyle = {
  ...helperTextStyle,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderSoft}`,
  background: 'rgba(255, 248, 222, 0.9)',
  color: color.textSoft,
  width: 'fit-content',
} as const;

const pulseStyle = {
  position: 'absolute' as const,
  inset: 0,
  borderRadius: radius.md,
  border: `1px solid rgba(17, 17, 17, 0.14)`,
  boxShadow: '0 0 0 1px rgba(184, 140, 84, 0.08) inset',
  pointerEvents: 'none' as const,
  animation: 'continuum-vercel-ai-sdk-pulse 2.2s ease-in-out infinite',
} as const;

export interface VercelAiSdkPreviewPanelProps {
  previewFrameRef: MutableRefObject<HTMLDivElement | null>;
  previewStatusText: string | null;
  isGenerating: boolean;
  renderedView: ViewDefinition;
  snapshotOverride: ContinuitySnapshot | null;
  renderScope:
    | {
        kind: 'draft';
        streamId: string;
      }
    | undefined;
}

export function VercelAiSdkPreviewPanel({
  previewFrameRef,
  previewStatusText,
  isGenerating,
  renderedView,
  snapshotOverride,
  renderScope,
}: VercelAiSdkPreviewPanelProps) {
  return (
    <section style={panelStyle}>
      <style>
        {`@keyframes continuum-vercel-ai-sdk-pulse {
          0% { opacity: 0.08; transform: scale(0.999); }
          50% { opacity: 0.22; transform: scale(1); }
          100% { opacity: 0.08; transform: scale(0.999); }
        }`}
      </style>
      <div style={{ ...type.section, color: color.text }}>
        Stable runtime after the stream
      </div>
      <div style={helperTextStyle}>
        Prompt on the left. Watch the working Continuum view stay stable here as
        streamed updates land and drafts evolve.
      </div>
      <div ref={previewFrameRef} style={previewFrameStyle}>
        {previewStatusText ? (
          <div style={previewNoteStyle}>{previewStatusText}</div>
        ) : null}
        {isGenerating ? <div style={pulseStyle} aria-hidden="true" /> : null}
        <ContinuumRenderer
          view={renderedView}
          snapshotOverride={snapshotOverride}
          renderScope={renderScope}
        />
      </div>
    </section>
  );
}
