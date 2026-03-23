import { useEffect, useMemo, useState } from 'react';
import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
import {
  useContinuumDiagnostics,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumRestoreReviews,
} from '@continuum-dev/react';
import {
  buildCheckpointOptions,
  buildProposalItems,
  buildRestoreReviewSections,
  collectDefaultSeeds,
  collectNodeMeta,
  getCurrentCheckpointId,
  shouldApplySeed,
  type StarterKitCheckpointOption,
  type StarterKitCheckpointPreview,
  type RestoreReviewSection,
} from './session-workbench-model.js';
import {
  createStarterKitSessionAdapter,
  type StarterKitSessionLike,
} from './session-adapter.js';

interface StarterKitDiagnosticCheckpoint {
  checkpointId: string;
  trigger: 'auto' | 'manual';
  timestamp: number;
  snapshot: {
    view: ViewDefinition;
  };
}

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
  const diagnostics = useContinuumDiagnostics() as {
    checkpoints: StarterKitDiagnosticCheckpoint[];
  };
  const [selectedCheckpointId, setSelectedCheckpointId] = useState('');

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
  const checkpointOptions = useMemo(
    () => buildCheckpointOptions(diagnostics.checkpoints),
    [diagnostics.checkpoints]
  );
  const currentCheckpointId = useMemo(
    () => getCurrentCheckpointId(checkpointOptions),
    [checkpointOptions]
  );
  const rewindCheckpointOptions = useMemo(
    () =>
      checkpointOptions.filter(
        (checkpoint) => checkpoint.id !== currentCheckpointId
      ),
    [checkpointOptions, currentCheckpointId]
  );
  const selectedCheckpoint = useMemo(
    () =>
      rewindCheckpointOptions.find(
        (checkpoint) => checkpoint.id === selectedCheckpointId
      ),
    [rewindCheckpointOptions, selectedCheckpointId]
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
    if (!selectedCheckpointId) {
      args.onCheckpointPreviewRequest?.(null);
      return;
    }

    if (!selectedCheckpoint) {
      setSelectedCheckpointId('');
      args.onCheckpointPreviewRequest?.(null);
      return;
    }

    args.onCheckpointPreviewRequest?.({
      id: selectedCheckpoint.id,
      label: selectedCheckpoint.label,
      trigger: selectedCheckpoint.trigger,
      timestamp: selectedCheckpoint.timestamp,
      snapshot: {
        view: selectedCheckpoint.snapshot.view,
      },
    });
  }, [args, selectedCheckpoint, selectedCheckpointId]);

  useEffect(() => {
    setSelectedCheckpointId('');
    args.onCheckpointPreviewRequest?.(null);
  }, [args.clearCheckpointPreviewSignal, args.onCheckpointPreviewRequest]);

  function reset(): void {
    sessionAdapter.reset();
    sessionAdapter.applyView(args.initialView);
    setSelectedCheckpointId('');
    args.onCheckpointPreviewRequest?.(null);
    args.onAfterSessionReset?.();
  }

  function rewindSelectedCheckpoint(): void {
    if (!selectedCheckpoint) {
      return;
    }
    sessionAdapter.rewind(selectedCheckpoint.id);
    setSelectedCheckpointId('');
    args.onCheckpointPreviewRequest?.(null);
  }

  function clearPreview(): void {
    setSelectedCheckpointId('');
    args.onCheckpointPreviewRequest?.(null);
  }

  return {
    activeView,
    sessionId: sessionAdapter.sessionId,
    checkpointsCount: diagnostics.checkpoints.length,
    proposalItems,
    restoreReviewSections,
    selectedCheckpointId,
    setSelectedCheckpointId,
    rewindCheckpointOptions,
    selectedCheckpoint,
    reset,
    acceptProposal: sessionAdapter.acceptProposal,
    rejectProposal: sessionAdapter.rejectProposal,
    acceptRestoreCandidate: sessionAdapter.acceptRestoreCandidate,
    rejectRestoreReview: sessionAdapter.rejectRestoreReview,
    rewindSelectedCheckpoint,
    clearPreview,
  };
}
