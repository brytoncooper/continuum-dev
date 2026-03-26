export { ContinuumProvider, ContinuumRenderer } from '@continuum-dev/react';
export * from '@continuum-dev/core';
export type {
  ContinuumNodeMap,
  ContinuumNodeProps,
  ContinuumProviderProps,
  ContinuumPersistError,
} from '@continuum-dev/react';
export {
  useContinuumAction,
  useContinuumConflict,
  useContinuumDiagnostics,
  useContinuumHydrated,
  useContinuumRestoreCandidates,
  useContinuumRestoreReviews,
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumState,
  useContinuumSuggestions,
  useContinuumFocus,
} from '@continuum-dev/react';
export { starterKitComponentMap } from './lib/component-map.js';
export * from './lib/primitives/index.js';
export {
  FieldFrame,
  inputLikeStyle,
  useInputLikeStyle,
} from './lib/primitives/shared/field-frame.js';
export {
  nodeDescription,
  nodeLabel,
  nodeNumberProp,
  nodeOptions,
  nodePlaceholder,
  readNodeProp,
  scalarFieldDisplayString,
} from './lib/primitives/shared/node.js';
export * from './lib/proposals/conflict-banner.js';
export {
  FieldProposalPlacementProvider,
  useFieldProposalPlacement,
} from './lib/proposals/field-proposal-placement-context.js';
export type { FieldProposalPlacement } from './lib/proposals/field-proposal-placement-context.js';
export * from './lib/proposals/field-proposal.js';
export * from './lib/proposals/restore-badge.js';
export * from './lib/proposals/restore-review-card.js';
export * from './lib/proposals/suggestions-bar.js';
export * from './lib/tokens.js';

export {
  StarterKitStyleProvider,
  starterKitDefaultStyles,
} from './lib/style-config.js';
export type {
  StarterKitStyleConfig,
  StarterKitStyleSlot,
} from './lib/style-config.js';

export { StarterKitSessionWorkbench } from './lib/ai/session-workbench.js';
export type {
  StarterKitCheckpointPreview,
  StarterKitTimelinePreview,
  StarterKitSessionWorkbenchProps,
} from './lib/ai/session-workbench.js';
export {
  useStarterKitTimeline,
  type UseStarterKitTimelineResult,
} from './lib/ai/use-starter-kit-timeline.js';
export type {
  StarterKitCheckpointOption,
  StarterKitTimelineEntry,
  StarterKitTimelineOption,
} from './lib/ai/session-workbench-model.js';
