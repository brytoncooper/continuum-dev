import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Checkpoint } from '@continuum-dev/core';
import { useContinuumDiagnostics, useContinuumSession } from '@continuum-dev/react';
import {
  buildTimelineEntries,
  getCurrentTimelineId,
  type StarterKitTimelineEntry,
  type StarterKitTimelinePreview,
} from './session-workbench-model.js';
import {
  createStarterKitSessionAdapter,
  type StarterKitSessionLike,
} from './session-adapter.js';

export interface UseStarterKitTimelineResult {
  entries: StarterKitTimelineEntry[];
  currentEntry?: StarterKitTimelineEntry;
  currentEntryId: string;
  currentEntryIndex: number;
  selectedEntry?: StarterKitTimelineEntry;
  selectedEntryId: string;
  selectedEntryIndex: number;
  previewEntry?: StarterKitTimelinePreview;
  setSelectedEntryId(entryId: string): void;
  setSelectedEntryIndex(index: number): void;
  rewindSelected(): void;
  clearPreview(): void;
}

function findEntryIndex(
  entries: StarterKitTimelineEntry[],
  entryId: string
): number {
  return entries.findIndex((entry) => entry.id === entryId);
}

export function useStarterKitTimeline(): UseStarterKitTimelineResult {
  const session = useContinuumSession() as StarterKitSessionLike;
  const sessionAdapter = useMemo(
    () => createStarterKitSessionAdapter(session),
    [session]
  );
  const diagnostics = useContinuumDiagnostics() as {
    checkpoints: Checkpoint[];
  };
  const [previewEntryId, setPreviewEntryId] = useState('');

  const entries = useMemo(
    () => buildTimelineEntries(diagnostics.checkpoints),
    [diagnostics.checkpoints]
  );
  const currentEntryId = useMemo(
    () => getCurrentTimelineId(entries) ?? '',
    [entries]
  );
  const currentEntry = useMemo(
    () => entries.find((entry) => entry.id === currentEntryId),
    [currentEntryId, entries]
  );
  const previewEntry = useMemo(() => {
    if (!previewEntryId) {
      return undefined;
    }

    return entries.find((entry) => entry.id === previewEntryId);
  }, [entries, previewEntryId]);
  const selectedEntry = previewEntry ?? currentEntry;
  const currentEntryIndex = useMemo(
    () => findEntryIndex(entries, currentEntryId),
    [currentEntryId, entries]
  );
  const selectedEntryIndex = useMemo(
    () => (selectedEntry ? findEntryIndex(entries, selectedEntry.id) : -1),
    [entries, selectedEntry]
  );

  useEffect(() => {
    if (!previewEntryId) {
      return;
    }

    if (previewEntryId === currentEntryId) {
      setPreviewEntryId('');
      return;
    }

    if (!entries.some((entry) => entry.id === previewEntryId)) {
      setPreviewEntryId('');
    }
  }, [currentEntryId, entries, previewEntryId]);

  const setSelectedEntryId = useCallback((entryId: string): void => {
    if (!entryId || entryId === currentEntryId) {
      setPreviewEntryId('');
      return;
    }

    setPreviewEntryId(entryId);
  }, [currentEntryId]);

  const setSelectedEntryIndex = useCallback((index: number): void => {
    const nextEntry = entries[index];
    if (!nextEntry || nextEntry.id === currentEntryId) {
      setPreviewEntryId('');
      return;
    }

    setPreviewEntryId(nextEntry.id);
  }, [currentEntryId, entries]);

  const rewindSelected = useCallback((): void => {
    if (!previewEntry) {
      return;
    }

    sessionAdapter.rewind(previewEntry.id);
    setPreviewEntryId('');
  }, [previewEntry, sessionAdapter]);

  const clearPreview = useCallback((): void => {
    setPreviewEntryId('');
  }, []);

  return {
    entries,
    currentEntry,
    currentEntryId,
    currentEntryIndex,
    selectedEntry,
    selectedEntryId: selectedEntry?.id ?? '',
    selectedEntryIndex,
    previewEntry,
    setSelectedEntryId,
    setSelectedEntryIndex,
    rewindSelected,
    clearPreview,
  };
}
