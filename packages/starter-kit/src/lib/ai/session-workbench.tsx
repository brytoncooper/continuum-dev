import type { ViewDefinition } from '@continuum-dev/core';
import { ContinuumRenderer } from '@continuum-dev/react';
import {
  color,
  control,
  radius,
  space,
  type as typography,
} from '../tokens.js';
import { ConflictBanner } from '../proposals/conflict-banner.js';
import { RestoreReviewCard } from '../proposals/restore-review-card.js';
import { StarterKitSuggestionsBar } from '../proposals/suggestions-bar.js';
import {
  formatTimestamp,
  type StarterKitCheckpointPreview,
  type StarterKitTimelinePreview,
} from './session-workbench-model.js';
import { useSessionWorkbench } from './use-session-workbench.js';

export type {
  StarterKitCheckpointPreview,
  StarterKitTimelinePreview,
} from './session-workbench-model.js';

export interface StarterKitSessionWorkbenchProps {
  initialView: ViewDefinition;
  resetLabel?: string;
  showInlineCheckpointPreview?: boolean;
  showInlineTimelinePreview?: boolean;
  showTimelineControls?: boolean;
  onCheckpointPreviewRequest?: (
    checkpoint: StarterKitCheckpointPreview | null
  ) => void;
  onTimelinePreviewRequest?: (
    timeline: StarterKitTimelinePreview | null
  ) => void;
  clearCheckpointPreviewSignal?: number;
  clearTimelinePreviewSignal?: number;
  /**
   * Runs **after** the workbench reset button finishes Continuum work, in this order:
   * 1. `session.reset()` — clears committed view/data, streams, checkpoints, proposals, etc.
   * 2. `applyView(initialView)` — restores the baseline view.
   * 3. Timeline preview UI is cleared.
   * 4. **Then** this callback runs.
   *
   * Continuum does **not** clear separate UI state (e.g. a Vercel AI SDK `useChat` message list).
   * Typical integration: bump a React `key` on the chat subtree here so the transcript resets in
   * sync with the form reset, without adding server-side session storage.
   */
  onAfterSessionReset?: () => void;
}

export function StarterKitSessionWorkbench({
  initialView,
  resetLabel = 'Reset form',
  showInlineCheckpointPreview = true,
  showInlineTimelinePreview,
  showTimelineControls = true,
  onCheckpointPreviewRequest,
  onTimelinePreviewRequest,
  clearCheckpointPreviewSignal,
  clearTimelinePreviewSignal,
  onAfterSessionReset,
}: StarterKitSessionWorkbenchProps) {
  const showInlinePreview =
    showInlineTimelinePreview ?? showInlineCheckpointPreview;
  const previewRequestHandler =
    onTimelinePreviewRequest ?? onCheckpointPreviewRequest;
  const clearPreviewSignal =
    clearTimelinePreviewSignal ?? clearCheckpointPreviewSignal;
  const {
    sessionId,
    checkpointsCount,
    proposalItems,
    restoreReviewSections,
    selectedCheckpointId,
    setSelectedCheckpointId,
    rewindCheckpointOptions,
    selectedCheckpoint,
    reset,
    acceptProposal,
    rejectProposal,
    acceptRestoreCandidate,
    rejectRestoreReview,
    rewindSelectedCheckpoint,
    clearPreview,
  } = useSessionWorkbench({
    initialView,
    onCheckpointPreviewRequest: previewRequestHandler,
    clearCheckpointPreviewSignal: clearPreviewSignal,
    onAfterSessionReset,
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
          Session: {sessionId.slice(0, 8)} | Timeline snapshots:{' '}
          {checkpointsCount}
        </span>
      </div>

      <StarterKitSuggestionsBar label="AI suggestions are available for your current values." />

      {restoreReviewSections.length > 0 ? (
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
            Possible restores
          </div>
          <div style={{ ...typography.small, color: color.textSoft }}>
            Continuum found likely matches for preserved values, but it is
            waiting for your approval instead of guessing.
          </div>
          {restoreReviewSections.map((section) => (
            <div key={section.id} style={{ display: 'grid', gap: space.sm }}>
              <div style={{ ...typography.small, color: color.text }}>
                {section.title}
              </div>
              {section.items.map((item) => (
                <RestoreReviewCard
                  key={item.reviewId}
                  review={item}
                  onApply={(candidate) => {
                    acceptRestoreCandidate(
                      item.detachedKey,
                      candidate.targetNodeId,
                      item.scope
                    );
                  }}
                  onRejectAll={() => {
                    rejectRestoreReview(item.detachedKey, item.scope);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

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
            Field proposals
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

      {showTimelineControls && rewindCheckpointOptions.length > 0 ? (
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
            Timeline preview
          </span>
          <span style={{ ...typography.small, color: color.textSoft }}>
            Select a timeline entry to preview it before rewinding.
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
            <option value="">Select timeline entry</option>
            {rewindCheckpointOptions
              .slice()
              .reverse()
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
          </select>

          {selectedCheckpoint && showInlinePreview ? (
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
                {selectedCheckpoint.trigger.toUpperCase()} snapshot from{' '}
                {formatTimestamp(selectedCheckpoint.timestamp)}
              </div>
              <ContinuumRenderer
                view={selectedCheckpoint.snapshot.view}
                snapshotOverride={selectedCheckpoint.snapshot}
                renderScope={null}
              />
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
                  Rewind to this timeline entry
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
                  Cancel timeline preview
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
