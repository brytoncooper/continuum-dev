import type { ViewDefinition } from '@continuum-dev/core';
import { ContinuumRenderer } from '@continuum-dev/react';
import { color, control, radius, space, type as typography } from '../tokens.js';
import { ConflictBanner } from '../proposals/conflict-banner.js';
import { StarterKitSuggestionsBar } from '../proposals/suggestions-bar.js';
import {
  formatTimestamp,
  type StarterKitCheckpointPreview,
} from './session-workbench-model.js';
import { useSessionWorkbench } from './use-session-workbench.js';

export type { StarterKitCheckpointPreview } from './session-workbench-model.js';

export interface StarterKitSessionWorkbenchProps {
  initialView: ViewDefinition;
  resetLabel?: string;
  showInlineCheckpointPreview?: boolean;
  onCheckpointPreviewRequest?: (
    checkpoint: StarterKitCheckpointPreview | null
  ) => void;
  clearCheckpointPreviewSignal?: number;
}

export function StarterKitSessionWorkbench({
  initialView,
  resetLabel = 'Reset form',
  showInlineCheckpointPreview = true,
  onCheckpointPreviewRequest,
  clearCheckpointPreviewSignal,
}: StarterKitSessionWorkbenchProps) {
  const {
    sessionId,
    checkpointsCount,
    proposalItems,
    selectedCheckpointId,
    setSelectedCheckpointId,
    rewindCheckpointOptions,
    selectedCheckpoint,
    reset,
    acceptProposal,
    rejectProposal,
    rewindSelectedCheckpoint,
    clearPreview,
  } = useSessionWorkbench({
    initialView,
    onCheckpointPreviewRequest,
    clearCheckpointPreviewSignal,
  });

  return (
    <div style={{ display: 'grid', gap: space.sm }}>
      <div
        style={{
          display: 'flex',
          gap: space.sm,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          style={{
            boxSizing: 'border-box',
            height: control.height,
            padding: `0 ${space.md}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            background: color.surfaceMuted,
            color: color.text,
            cursor: 'pointer',
            ...typography.body,
          }}
          onClick={() => {
            reset();
          }}
        >
          {resetLabel}
        </button>
        <span style={{ ...typography.small, color: color.textMuted }}>
          Session: {sessionId.slice(0, 8)} | Checkpoints: {checkpointsCount}
        </span>
      </div>

      <StarterKitSuggestionsBar label="AI suggestions are available for your current values." />

      {proposalItems.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            background: color.surfaceMuted,
          }}
        >
          <div style={{ ...typography.small, color: color.textMuted }}>
            Field checkpoints
          </div>
          <div style={{ ...typography.small, color: color.textSoft }}>
            Review each AI proposal before applying it to the live form.
          </div>
          {proposalItems.map((item) => (
            <ConflictBanner
              key={item.nodeId}
              title={item.title}
              currentValue={item.currentValue}
              nextValue={item.nextValue}
              tone="proposal"
              currentLabel="Current value"
              nextLabel="AI suggestion"
              onAccept={() => {
                acceptProposal(item.nodeId);
              }}
              onReject={() => {
                rejectProposal(item.nodeId);
              }}
            />
          ))}
        </div>
      ) : null}

      {rewindCheckpointOptions.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gap: space.sm,
            padding: space.md,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            background: color.surfaceMuted,
          }}
        >
          <span style={{ ...typography.small, color: color.textMuted }}>
            Checkpoint preview
          </span>
          <span style={{ ...typography.small, color: color.textSoft }}>
            Select a checkpoint to preview it before rewinding.
          </span>
          <select
            value={selectedCheckpointId}
            style={{
              boxSizing: 'border-box',
              height: control.height,
              borderRadius: radius.md,
              border: `1px solid ${color.border}`,
              padding: `0 ${space.md}px`,
              ...typography.body,
            }}
            onChange={(event) => {
              setSelectedCheckpointId(event.target.value);
            }}
          >
            <option value="">Select checkpoint to preview</option>
            {rewindCheckpointOptions
              .slice()
              .reverse()
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>

          {selectedCheckpoint && showInlineCheckpointPreview ? (
            <div
              style={{
                display: 'grid',
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.md,
                border: `1px solid ${color.borderSoft}`,
                background: color.surface,
              }}
            >
              <div style={{ ...typography.small, color: color.text }}>
                Previewing {selectedCheckpoint.label}
              </div>
              <div style={{ ...typography.small, color: color.textMuted }}>
                {selectedCheckpoint.trigger.toUpperCase()} checkpoint from{' '}
                {formatTimestamp(selectedCheckpoint.timestamp)}
              </div>
              <ContinuumRenderer view={selectedCheckpoint.snapshot.view} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: space.sm,
                  flexWrap: 'nowrap',
                }}
              >
                <button
                  type="button"
                  style={{
                    boxSizing: 'border-box',
                    height: control.height,
                    padding: `0 ${space.md}px`,
                    borderRadius: radius.md,
                    border: `1px solid ${color.borderStrong}`,
                    background: color.accent,
                    color: color.surface,
                    cursor: 'pointer',
                    ...typography.body,
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    rewindSelectedCheckpoint();
                  }}
                >
                  Rewind to this checkpoint
                </button>
                <button
                  type="button"
                  style={{
                    boxSizing: 'border-box',
                    height: control.height,
                    padding: `0 ${space.md}px`,
                    borderRadius: radius.md,
                    border: `1px solid ${color.border}`,
                    background: color.surfaceMuted,
                    color: color.text,
                    cursor: 'pointer',
                    ...typography.body,
                  }}
                  onClick={() => {
                    clearPreview();
                  }}
                >
                  Cancel preview
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
