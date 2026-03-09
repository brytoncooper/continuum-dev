import { useEffect, useMemo, useState } from 'react';
import type { NodeValue, ViewDefinition, ViewNode } from '@continuum-dev/core';
import {
  ContinuumRenderer,
  useContinuumDiagnostics,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { color, control, radius, space, type as typography } from '../tokens.js';
import { ConflictBanner } from '../proposals/conflict-banner.js';
import { StarterKitSuggestionsBar } from '../proposals/suggestions-bar.js';

interface DefaultSeed {
  nodeId: string;
  defaultValue: unknown;
}

function readDefaultValue(node: ViewNode): unknown {
  return (node as unknown as Record<string, unknown>).defaultValue;
}

function readChildrenForDefaults(node: ViewNode): ViewNode[] {
  if (
    node.type === 'group' ||
    node.type === 'row' ||
    node.type === 'grid'
  ) {
    const children = (node as unknown as { children?: ViewNode[] }).children;
    return Array.isArray(children) ? children : [];
  }
  return [];
}

function collectDefaultSeeds(
  nodes: ViewNode[],
  parentId?: string
): DefaultSeed[] {
  const seeds: DefaultSeed[] = [];

  for (const node of nodes) {
    const nodeId = parentId ? `${parentId}/${node.id}` : node.id;
    const defaultValue = readDefaultValue(node);
    if (typeof defaultValue !== 'undefined') {
      seeds.push({ nodeId, defaultValue });
    }

    const children = readChildrenForDefaults(node);
    if (children.length > 0) {
      seeds.push(...collectDefaultSeeds(children, nodeId));
    }
  }

  return seeds;
}

function hasValue(value: unknown): boolean {
  return !(value === null || value === undefined || value === '');
}

interface NodeMeta {
  nodeId: string;
  label?: string;
}

interface ProposalItem {
  nodeId: string;
  title: string;
  currentValue: string;
  nextValue: string;
}

export interface StarterKitCheckpointPreview {
  id: string;
  label: string;
  trigger: 'auto' | 'manual';
  timestamp: number;
  snapshot: {
    view: ViewDefinition;
  };
}

function readString(node: ViewNode, key: string): string | undefined {
  const value = (node as unknown as Record<string, unknown>)[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readChildren(node: ViewNode): ViewNode[] {
  if (
    node.type === 'group' ||
    node.type === 'row' ||
    node.type === 'grid'
  ) {
    const children = (node as unknown as { children?: ViewNode[] }).children;
    return Array.isArray(children) ? children : [];
  }

  if (node.type === 'collection') {
    const template = (node as unknown as { template?: ViewNode }).template;
    return template ? [template] : [];
  }

  return [];
}

function collectNodeMeta(
  nodes: ViewNode[],
  parentId?: string,
  output = new Map<string, NodeMeta>()
): Map<string, NodeMeta> {
  for (const node of nodes) {
    const nodeId = parentId ? `${parentId}/${node.id}` : node.id;
    output.set(nodeId, {
      nodeId,
      label: readString(node, 'label'),
    });

    const children = readChildren(node);
    if (children.length > 0) {
      collectNodeMeta(children, nodeId, output);
    }
  }

  return output;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function formatTimestamp(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString();
}

export function StarterKitSessionWorkbench({
  initialView,
  resetLabel = 'Reset form',
  showInlineCheckpointPreview = true,
  onCheckpointPreviewRequest,
  clearCheckpointPreviewSignal,
}: {
  initialView: ViewDefinition;
  resetLabel?: string;
  showInlineCheckpointPreview?: boolean;
  onCheckpointPreviewRequest?: (
    checkpoint: StarterKitCheckpointPreview | null
  ) => void;
  clearCheckpointPreviewSignal?: number;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const { checkpoints } = useContinuumDiagnostics();
  const [selectedCheckpointId, setSelectedCheckpointId] = useState('');

  const activeView = snapshot?.view ?? initialView;
  const nodeMetaById = useMemo(
    () => collectNodeMeta(activeView.nodes),
    [activeView.nodes]
  );

  const pendingProposals = session.getPendingProposals();
  const proposalItems = useMemo(() => {
    const values = snapshot?.data.values ?? {};
    return Object.entries(pendingProposals).map(([nodeId, proposal]) => {
      const meta = nodeMetaById.get(nodeId);
      const currentValue = values[nodeId];
      return {
        nodeId,
        title: meta?.label ?? 'Field suggestion',
        currentValue: stringifyValue(currentValue?.value),
        nextValue: stringifyValue(proposal.proposedValue.value),
      } satisfies ProposalItem;
    });
  }, [nodeMetaById, pendingProposals, snapshot]);

  const checkpointOptions = useMemo(
    () =>
      checkpoints.map((checkpoint) => ({
        id: checkpoint.checkpointId,
        label: `${checkpoint.snapshot.view.viewId}@${checkpoint.snapshot.view.version}`,
        trigger: checkpoint.trigger,
        timestamp: checkpoint.timestamp,
        snapshot: checkpoint.snapshot,
      })),
    [checkpoints]
  );
  const currentCheckpointId = useMemo(() => {
    if (checkpointOptions.length === 0) {
      return undefined;
    }

    return checkpointOptions.reduce((latest, checkpoint) =>
      checkpoint.timestamp > latest.timestamp ? checkpoint : latest
    ).id;
  }, [checkpointOptions]);
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
      const current = snapshot.data.values[seed.nodeId] as NodeValue | undefined;

      if (!current) {
        session.updateState(seed.nodeId, {
          value: seed.defaultValue,
          isDirty: false,
        } as NodeValue);
        continue;
      }

      if (
        !hasValue(current.value) &&
        !current.isDirty &&
        current.suggestion !== seed.defaultValue
      ) {
        session.updateState(seed.nodeId, {
          ...current,
          value: seed.defaultValue,
          isDirty: false,
        } as NodeValue);
        continue;
      }

    }
  }, [seeds, session, snapshot]);

  useEffect(() => {
    if (!selectedCheckpointId) {
      onCheckpointPreviewRequest?.(null);
      return;
    }

    if (!selectedCheckpoint) {
      setSelectedCheckpointId('');
      onCheckpointPreviewRequest?.(null);
      return;
    }

    onCheckpointPreviewRequest?.({
      id: selectedCheckpoint.id,
      label: selectedCheckpoint.label,
      trigger: selectedCheckpoint.trigger,
      timestamp: selectedCheckpoint.timestamp,
      snapshot: {
        view: selectedCheckpoint.snapshot.view,
      },
    });
  }, [onCheckpointPreviewRequest, selectedCheckpoint, selectedCheckpointId]);

  useEffect(() => {
    setSelectedCheckpointId('');
    onCheckpointPreviewRequest?.(null);
  }, [clearCheckpointPreviewSignal, onCheckpointPreviewRequest]);

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
                session.reset();
                session.pushView(initialView);
                setSelectedCheckpointId('');
                onCheckpointPreviewRequest?.(null);
              }}
            >
              {resetLabel}
        </button>
        <span style={{ ...typography.small, color: color.textMuted }}>
          Session: {session.sessionId.slice(0, 8)} | Checkpoints: {checkpoints.length}
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
                session.acceptProposal(item.nodeId);
              }}
              onReject={() => {
                session.rejectProposal(item.nodeId);
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
                    session.rewind(selectedCheckpoint.id);
                    setSelectedCheckpointId('');
                    onCheckpointPreviewRequest?.(null);
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
                    setSelectedCheckpointId('');
                    onCheckpointPreviewRequest?.(null);
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
