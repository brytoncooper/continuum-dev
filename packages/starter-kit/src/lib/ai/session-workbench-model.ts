import type {
  Checkpoint,
  ContinuitySnapshot,
  DetachedRestoreReview,
  DetachedRestoreScope,
  NodeValue,
  ViewNode,
} from '@continuum-dev/core';
import { isProtectedNodeValue } from '@continuum-dev/core';
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

export interface RestoreReviewCandidateItem {
  candidateId: string;
  targetNodeId: string;
  title: string;
  subtitle?: string;
}

export interface RestoreReviewItem {
  reviewId: string;
  detachedKey: string;
  title: string;
  valuePreview: string;
  status: DetachedRestoreReview['status'];
  scope: DetachedRestoreScope;
  candidates: RestoreReviewCandidateItem[];
  approvedTargetLabel?: string;
}

export interface RestoreReviewSection {
  id: 'draft' | 'live';
  title: string;
  items: RestoreReviewItem[];
}

export interface StarterKitTimelineEntry {
  id: string;
  label: string;
  trigger: 'auto' | 'manual';
  timestamp: number;
  snapshot: ContinuitySnapshot;
}

export type StarterKitTimelinePreview = StarterKitTimelineEntry;
export type StarterKitTimelineOption = StarterKitTimelineEntry;
export type StarterKitCheckpointPreview = StarterKitTimelinePreview;
export type StarterKitCheckpointOption = StarterKitTimelineOption;

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

  if (isProtectedNodeValue(current)) {
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
  if (
    value &&
    typeof value === 'object' &&
    'value' in (value as Record<string, unknown>)
  ) {
    return stringifyValue((value as Record<string, unknown>).value);
  }
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

function formatTimelineLabel(snapshot: ContinuitySnapshot): string {
  const version = snapshot.view.version.trim();
  return version.length > 0 ? version : snapshot.view.viewId;
}

export function buildTimelineEntries(
  checkpoints: Array<
    Pick<Checkpoint, 'checkpointId' | 'trigger' | 'timestamp' | 'snapshot'>
  >
): StarterKitTimelineEntry[] {
  return checkpoints.map((checkpoint) => ({
    id: checkpoint.checkpointId,
    label: formatTimelineLabel(checkpoint.snapshot),
    trigger: checkpoint.trigger,
    timestamp: checkpoint.timestamp,
    snapshot: checkpoint.snapshot,
  }));
}

export function buildCheckpointOptions(
  checkpoints: Array<
    Pick<Checkpoint, 'checkpointId' | 'trigger' | 'timestamp' | 'snapshot'>
  >
): StarterKitCheckpointOption[] {
  return buildTimelineEntries(checkpoints);
}

export function getCurrentTimelineId(
  timelineEntries: StarterKitTimelineEntry[]
): string | undefined {
  if (timelineEntries.length === 0) {
    return undefined;
  }

  return timelineEntries.reduce((latest, checkpoint) =>
    checkpoint.timestamp >= latest.timestamp ? checkpoint : latest
  ).id;
}

export function getCurrentCheckpointId(
  checkpointOptions: StarterKitCheckpointOption[]
): string | undefined {
  return getCurrentTimelineId(checkpointOptions);
}

function scopeSortKey(scope: DetachedRestoreScope): number {
  return scope.kind === 'draft' ? 0 : 1;
}

function sectionIdForScope(
  scope: DetachedRestoreScope
): RestoreReviewSection['id'] {
  return scope.kind === 'draft' ? 'draft' : 'live';
}

export function buildRestoreReviewSections(
  reviews: DetachedRestoreReview[]
): RestoreReviewSection[] {
  const sections = new Map<RestoreReviewSection['id'], RestoreReviewSection>();
  const sortedReviews = reviews
    .filter((review) => review.status !== 'waiting')
    .sort((left, right) => {
      const scopeOrder = scopeSortKey(left.scope) - scopeSortKey(right.scope);
      if (scopeOrder !== 0) {
        return scopeOrder;
      }
      return left.reviewId.localeCompare(right.reviewId);
    });

  for (const review of sortedReviews) {
    const sectionId = sectionIdForScope(review.scope);
    const section = sections.get(sectionId) ?? {
      id: sectionId,
      title: sectionId === 'draft' ? 'In draft preview' : 'In live form',
      items: [],
    };

    section.items.push({
      reviewId: review.reviewId,
      detachedKey: review.detachedKey,
      title: review.detachedValue.previousLabel ?? review.detachedKey,
      valuePreview: stringifyValue(review.detachedValue.value),
      status: review.status,
      scope: review.scope,
      approvedTargetLabel:
        review.approvedTarget?.targetSemanticKey ??
        review.approvedTarget?.targetKey ??
        review.approvedTarget?.targetNodeId,
      candidates: review.candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        targetNodeId: candidate.targetNodeId,
        title: candidate.targetLabel ?? candidate.targetNodeId,
        subtitle: candidate.targetParentLabel,
      })),
    });
    sections.set(sectionId, section);
  }

  return ['draft', 'live']
    .map((id) => sections.get(id as RestoreReviewSection['id']))
    .filter((section): section is RestoreReviewSection => Boolean(section));
}
