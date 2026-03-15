import type { DataSnapshot, ViewNode } from '@continuum-dev/contract';
import type { ReconciliationContext } from '../../context/index.js';
import type {
  NodeResolutionAccumulator,
  ReconciliationOptions,
  ReconciliationResolution,
} from '../../types.js';

export type MatchStrategy = ReconciliationResolution['matchedBy'];
export type ConcreteMatchStrategy = Exclude<MatchStrategy, null>;

export interface NodeMatchEnvelope {
  newId: string;
  newNode: ViewNode;
  priorNode: ViewNode | null;
  priorNodeId: string | null;
  matchedBy: MatchStrategy;
  priorValue: unknown;
}

export interface NodeResolutionRuntime {
  acc: NodeResolutionAccumulator;
  ctx: ReconciliationContext;
  priorData: DataSnapshot;
  now: number;
  options: ReconciliationOptions;
}

export interface ResolveNodeInput {
  match: NodeMatchEnvelope;
  runtime: NodeResolutionRuntime;
}

export interface ResolveNewNodeInput {
  acc: NodeResolutionAccumulator;
  newId: string;
  newNode: ViewNode;
  priorData: DataSnapshot;
}

export interface ResolveCollectionNodeInput {
  acc: NodeResolutionAccumulator;
  newId: string;
  priorNode: Extract<ViewNode, { type: 'collection' }>;
  priorNodeId: string;
  newNode: Extract<ViewNode, { type: 'collection' }>;
  matchedBy: ConcreteMatchStrategy;
  priorValue: unknown;
  priorData: DataSnapshot;
  now: number;
  options: ReconciliationOptions;
}

export interface ResolveTypeMismatchedNodeInput {
  acc: NodeResolutionAccumulator;
  ctx: ReconciliationContext;
  newId: string;
  priorNode: ViewNode;
  priorNodeId: string;
  newNode: ViewNode;
  matchedBy: MatchStrategy;
  priorValue: unknown;
  now: number;
}

export interface ResolveHashChangedNodeInput {
  acc: NodeResolutionAccumulator;
  newId: string;
  priorNode: ViewNode;
  priorNodeId: string;
  newNode: ViewNode;
  matchedBy: ConcreteMatchStrategy;
  priorValue: unknown;
  priorData: DataSnapshot;
  now: number;
  options: ReconciliationOptions;
}

export interface ResolveUnchangedNodeInput {
  acc: NodeResolutionAccumulator;
  newId: string;
  priorNode: ViewNode;
  priorNodeId: string;
  newNode: ViewNode;
  matchedBy: ConcreteMatchStrategy;
  priorValue: unknown;
  priorData: DataSnapshot;
  now: number;
}
