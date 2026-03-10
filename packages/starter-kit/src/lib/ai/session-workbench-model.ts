import type { NodeValue, ViewDefinition, ViewNode } from '@continuum-dev/core';
import type { StarterKitSessionSnapshot } from './session-adapter.js';

export interface DefaultSeed {
  nodeId: string;
  defaultValue: unknown;
}

export interface NodeMeta {
  nodeId: string;
  label?: string;
}

export interface ProposalItem {
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

export type StarterKitCheckpointOption = StarterKitCheckpointPreview;

function readDefaultValue(node: ViewNode): unknown {
  return (node as unknown as Record<string, unknown>).defaultValue;
}

function readChildrenForDefaults(node: ViewNode): ViewNode[] {
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    const children = (node as unknown as { children?: ViewNode[] }).children;
    return Array.isArray(children) ? children : [];
  }
  return [];
}

export function collectDefaultSeeds(
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

export function shouldApplySeed(
  current: NodeValue | undefined,
  defaultValue: unknown
): boolean {
  if (!current) {
    return true;
  }

  if (current.isDirty) {
    return false;
  }

  if (hasValue(current.value)) {
    return false;
  }

  if (Object.is(current.value, defaultValue)) {
    return false;
  }

  if (Object.is(current.suggestion, defaultValue)) {
    return false;
  }

  return true;
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
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    const children = (node as unknown as { children?: ViewNode[] }).children;
    return Array.isArray(children) ? children : [];
  }

  if (node.type === 'collection') {
    const template = (node as unknown as { template?: ViewNode }).template;
    return template ? [template] : [];
  }

  return [];
}

export function collectNodeMeta(
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

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function formatTimestamp(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString();
}

export function buildProposalItems(args: {
  pendingProposals: Record<
    string,
    {
      proposedValue: NodeValue;
    }
  >;
  nodeMetaById: Map<string, NodeMeta>;
  snapshot: StarterKitSessionSnapshot | undefined;
}): ProposalItem[] {
  const values = args.snapshot?.data.values ?? {};
  return Object.entries(args.pendingProposals).map(([nodeId, proposal]) => {
    const meta = args.nodeMetaById.get(nodeId);
    const currentValue = values[nodeId];
    return {
      nodeId,
      title: meta?.label ?? 'Field suggestion',
      currentValue: stringifyValue(currentValue?.value),
      nextValue: stringifyValue(proposal.proposedValue.value),
    } satisfies ProposalItem;
  });
}

export function buildCheckpointOptions(
  checkpoints: Array<{
    checkpointId: string;
    trigger: 'auto' | 'manual';
    timestamp: number;
    snapshot: {
      view: ViewDefinition;
    };
  }>
): StarterKitCheckpointOption[] {
  return checkpoints.map((checkpoint) => ({
    id: checkpoint.checkpointId,
    label: `${checkpoint.snapshot.view.viewId}@${checkpoint.snapshot.view.version}`,
    trigger: checkpoint.trigger,
    timestamp: checkpoint.timestamp,
    snapshot: checkpoint.snapshot,
  }));
}

export function getCurrentCheckpointId(
  checkpointOptions: StarterKitCheckpointOption[]
): string | undefined {
  if (checkpointOptions.length === 0) {
    return undefined;
  }

  return checkpointOptions.reduce((latest, checkpoint) =>
    checkpoint.timestamp > latest.timestamp ? checkpoint : latest
  ).id;
}
