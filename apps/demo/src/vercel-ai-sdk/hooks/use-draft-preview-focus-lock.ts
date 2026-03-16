import type { ContinuitySnapshot, ViewDefinition } from '@continuum-dev/core';
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface DraftPreviewStreamLike {
  streamId: string;
  mode: 'foreground' | 'draft';
  status: string;
  previewView: ViewDefinition | null;
  previewData: ContinuitySnapshot['data'] | null;
  updatedAt: number;
  latestStatus?: {
    status: string;
  } | null;
}

interface FocusedPreviewControlState {
  nodeId: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: 'forward' | 'backward' | 'none' | null;
}

function readPreviewControl(
  target: EventTarget | null
): HTMLInputElement | HTMLTextAreaElement | null {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.dataset.continuumControl === 'true' ? target : null;
  }

  return null;
}

function captureFocusedPreviewControl(
  target: EventTarget | null
): FocusedPreviewControlState | null {
  const control = readPreviewControl(target);
  const nodeId = control?.dataset.continuumNodeId;
  if (!control || !nodeId) {
    return null;
  }

  return {
    nodeId,
    selectionStart: control.selectionStart,
    selectionEnd: control.selectionEnd,
    selectionDirection: control.selectionDirection,
  };
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface UseDraftPreviewFocusLockArgs {
  liveView: ViewDefinition;
  streams: Iterable<DraftPreviewStreamLike>;
}

export interface UseDraftPreviewFocusLockResult {
  previewFrameRef: MutableRefObject<HTMLDivElement | null>;
  draftPreviewSnapshot: ContinuitySnapshot | null;
  draftPreviewStream: DraftPreviewStreamLike | null;
  renderScope:
    | {
        kind: 'draft';
        streamId: string;
      }
    | undefined;
  renderedView: ViewDefinition;
  lockedDraftStreamId: string | null;
}

export function useDraftPreviewFocusLock(
  args: UseDraftPreviewFocusLockArgs
): UseDraftPreviewFocusLockResult {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const focusedPreviewControlRef = useRef<FocusedPreviewControlState | null>(
    null
  );
  const [lockedDraftView, setLockedDraftView] = useState<ViewDefinition | null>(
    null
  );
  const [lockedDraftStreamId, setLockedDraftStreamId] = useState<string | null>(
    null
  );

  const draftPreviewStream = useMemo(
    () =>
      [...args.streams]
        .filter(
          (stream) =>
            stream.mode === 'draft' &&
            stream.status === 'open' &&
            stream.previewView !== null &&
            stream.previewData !== null
        )
        .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null,
    [args.streams]
  );
  const draftPreviewSnapshot = useMemo<ContinuitySnapshot | null>(
    () =>
      draftPreviewStream?.previewView && draftPreviewStream.previewData
        ? {
            view: draftPreviewStream.previewView,
            data: draftPreviewStream.previewData,
          }
        : null,
    [draftPreviewStream]
  );
  const renderedDraftView =
    draftPreviewStream &&
    lockedDraftView &&
    lockedDraftStreamId === draftPreviewStream.streamId
      ? lockedDraftView
      : draftPreviewStream?.previewView ?? null;

  const lockDraftPreview = useCallback(() => {
    if (!draftPreviewStream?.previewView) {
      return;
    }

    setLockedDraftView((current) =>
      lockedDraftStreamId === draftPreviewStream.streamId && current
        ? current
        : draftPreviewStream.previewView
    );
    setLockedDraftStreamId(draftPreviewStream.streamId);
  }, [draftPreviewStream, lockedDraftStreamId]);

  const unlockDraftPreview = useCallback(() => {
    setLockedDraftView(null);
    setLockedDraftStreamId(null);
  }, []);

  useEffect(() => {
    if (!draftPreviewStream) {
      setLockedDraftView(null);
      setLockedDraftStreamId(null);
      return;
    }

    if (
      lockedDraftStreamId &&
      lockedDraftStreamId !== draftPreviewStream.streamId
    ) {
      setLockedDraftView(null);
      setLockedDraftStreamId(null);
    }
  }, [draftPreviewStream, lockedDraftStreamId]);

  useEffect(() => {
    const container = previewFrameRef.current;
    if (!container || typeof document === 'undefined') {
      return;
    }

    const rememberControl = (target: EventTarget | null) => {
      const next = captureFocusedPreviewControl(target);
      if (next) {
        focusedPreviewControlRef.current = next;
      }
    };

    const handleContainerFocusIn = (event: FocusEvent) => {
      lockDraftPreview();
      rememberControl(event.target);
    };

    const handleContainerInput = (event: Event) => {
      rememberControl(event.target);
    };

    const handleContainerKeyUp = (event: KeyboardEvent) => {
      rememberControl(event.target);
    };

    const handleContainerClick = (event: MouseEvent) => {
      rememberControl(event.target);
    };

    const handleDocumentFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && container.contains(target)) {
        lockDraftPreview();
        rememberControl(target);
        return;
      }
      focusedPreviewControlRef.current = null;
      unlockDraftPreview();
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !container.contains(target)) {
        focusedPreviewControlRef.current = null;
        unlockDraftPreview();
      }
    };

    const handleSelectionChange = () => {
      const active = document.activeElement;
      if (active instanceof Node && container.contains(active)) {
        rememberControl(active);
      }
    };

    container.addEventListener('focusin', handleContainerFocusIn);
    container.addEventListener('input', handleContainerInput);
    container.addEventListener('keyup', handleContainerKeyUp);
    container.addEventListener('click', handleContainerClick);
    document.addEventListener('focusin', handleDocumentFocusIn);
    document.addEventListener('pointerdown', handleDocumentPointerDown);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      container.removeEventListener('focusin', handleContainerFocusIn);
      container.removeEventListener('input', handleContainerInput);
      container.removeEventListener('keyup', handleContainerKeyUp);
      container.removeEventListener('click', handleContainerClick);
      document.removeEventListener('focusin', handleDocumentFocusIn);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [lockDraftPreview, unlockDraftPreview]);

  useLayoutEffect(() => {
    if (!draftPreviewStream) {
      return;
    }

    const container = previewFrameRef.current;
    const focusedControl = focusedPreviewControlRef.current;
    if (!container || !focusedControl || typeof document === 'undefined') {
      return;
    }

    const active = readPreviewControl(document.activeElement);
    if (active?.dataset.continuumNodeId === focusedControl.nodeId) {
      return;
    }

    const next = container.querySelector(
      `[data-continuum-control="true"][data-continuum-node-id="${escapeAttributeValue(
        focusedControl.nodeId
      )}"]`
    ) as HTMLInputElement | HTMLTextAreaElement | null;

    if (!next) {
      return;
    }

    next.focus({ preventScroll: true });

    if (
      focusedControl.selectionStart === null ||
      focusedControl.selectionEnd === null
    ) {
      return;
    }

    const selectionStart = Math.min(
      focusedControl.selectionStart,
      next.value.length
    );
    const selectionEnd = Math.min(
      focusedControl.selectionEnd,
      next.value.length
    );

    try {
      next.setSelectionRange(
        selectionStart,
        selectionEnd,
        focusedControl.selectionDirection ?? undefined
      );
    } catch {
      // Some input types do not support selection restoration.
    }
  }, [draftPreviewSnapshot, draftPreviewStream]);

  return {
    previewFrameRef,
    draftPreviewSnapshot,
    draftPreviewStream,
    renderScope: draftPreviewStream
      ? { kind: 'draft', streamId: draftPreviewStream.streamId }
      : undefined,
    renderedView: renderedDraftView ?? args.liveView,
    lockedDraftStreamId,
  };
}
