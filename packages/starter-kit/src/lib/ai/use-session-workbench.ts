import { useEffect, useMemo } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
import {
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumRestoreReviews,
} from '@continuum-dev/react';
import {
  buildProposalItems,
  buildRestoreReviewSections,
  collectDefaultSeeds,
  collectNodeMeta,
  shouldApplySeed,
  type StarterKitCheckpointOption,
  type StarterKitCheckpointPreview,
  type RestoreReviewSection,
} from './session-workbench-model.js';
import {
  createStarterKitSessionAdapter,
  type StarterKitSessionLike,
} from './session-adapter.js';
import { useStarterKitTimeline } from './use-starter-kit-timeline.js';

export interface UseSessionWorkbenchArgs {
  initialView: ViewDefinition;
  onCheckpointPreviewRequest?: (
    checkpoint: StarterKitCheckpointPreview | null
  ) => void;
  clearCheckpointPreviewSignal?: number;
  /**
   * Same contract as `StarterKitSessionWorkbenchProps.onAfterSessionReset`.
   * Invoked at the end of `reset()` after Continuum state is cleared and `initialView` is reapplied.
   */
  onAfterSessionReset?: () => void;
}

export interface UseSessionWorkbenchResult {
  activeView: ViewDefinition;
  sessionId: string;
  checkpointsCount: number;
  proposalItems: ReturnType<typeof buildProposalItems>;
  restoreReviewSections: RestoreReviewSection[];
  selectedCheckpointId: string;
  setSelectedCheckpointId(checkpointId: string): void;
  rewindCheckpointOptions: StarterKitCheckpointOption[];
  selectedCheckpoint?: StarterKitCheckpointOption;
  reset(): void;
  acceptProposal(nodeId: string): void;
  rejectProposal(nodeId: string): void;
  acceptRestoreCandidate(
    detachedKey: string,
    targetNodeId: string,
    scope: RestoreReviewSection['items'][number]['scope']
  ): void;
  rejectRestoreReview(
    detachedKey: string,
    scope: RestoreReviewSection['items'][number]['scope']
  ): void;
  rewindSelectedCheckpoint(): void;
  clearPreview(): void;
}

export function useSessionWorkbench(
  args: UseSessionWorkbenchArgs
): UseSessionWorkbenchResult {
  const session = useContinuumSession() as StarterKitSessionLike;
  const sessionAdapter = useMemo(
    () => createStarterKitSessionAdapter(session),
    [session]
  );
  const snapshot = useContinuumSnapshot();
  const restoreReviews = useContinuumRestoreReviews();
  const timeline = useStarterKitTimeline();
  const {
    clearPreview: clearTimelinePreview,
    currentEntryId,
    entries: timelineEntries,
    previewEntry,
    rewindSelected,
    setSelectedEntryId,
  } = timeline;

  const activeView = snapshot?.view ?? args.initialView;
  const nodeMetaById = useMemo(
    () => collectNodeMeta(activeView.nodes),
    [activeView.nodes]
  );
  const pendingProposals = sessionAdapter.getPendingProposals();
  const proposalItems = useMemo(
    () =>
      buildProposalItems({
        pendingProposals,
        nodeMetaById,
        snapshot: snapshot
          ? {
              view: snapshot.view,
              data: {
                values: snapshot.data.values,
              },
            }
          : undefined,
      }),
    [nodeMetaById, pendingProposals, snapshot]
  );
  const restoreReviewSections = useMemo(
    () => buildRestoreReviewSections(restoreReviews),
    [restoreReviews]
  );
  const rewindCheckpointOptions = useMemo(
    () =>
      timelineEntries.filter((checkpoint) => checkpoint.id !== currentEntryId),
    [currentEntryId, timelineEntries]
  );
  const seeds = useMemo(
    () => collectDefaultSeeds(activeView.nodes),
    [activeView.nodes]
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    for (const seed of seeds) {
      const current = snapshot.data.values[seed.nodeId] as
        | NodeValue
        | undefined;

      if (shouldApplySeed(current, seed.defaultValue)) {
        sessionAdapter.updateState(seed.nodeId, {
          ...(current ?? {}),
          value: seed.defaultValue,
          isDirty: false,
        } as NodeValue);
      }
    }
  }, [seeds, sessionAdapter, snapshot]);

  useEffect(() => {
    args.onCheckpointPreviewRequest?.(previewEntry ?? null);
  }, [args.onCheckpointPreviewRequest, previewEntry]);

  useEffect(() => {
    clearTimelinePreview();
  }, [args.clearCheckpointPreviewSignal, clearTimelinePreview]);

  function reset(): void {
    sessionAdapter.reset();
    sessionAdapter.applyView(args.initialView);
    clearTimelinePreview();
    args.onAfterSessionReset?.();
  }

  function rewindSelectedCheckpoint(): void {
    rewindSelected();
  }

  function clearPreview(): void {
    clearTimelinePreview();
  }

  return {
    activeView,
    sessionId: sessionAdapter.sessionId,
    checkpointsCount: timelineEntries.length,
    proposalItems,
    restoreReviewSections,
    selectedCheckpointId: previewEntry?.id ?? '',
    setSelectedCheckpointId: setSelectedEntryId,
    rewindCheckpointOptions,
    selectedCheckpoint: previewEntry,
    reset,
    acceptProposal: sessionAdapter.acceptProposal,
    rejectProposal: sessionAdapter.rejectProposal,
    acceptRestoreCandidate: sessionAdapter.acceptRestoreCandidate,
    rejectRestoreReview: sessionAdapter.rejectRestoreReview,
    rewindSelectedCheckpoint,
    clearPreview,
  };
}
