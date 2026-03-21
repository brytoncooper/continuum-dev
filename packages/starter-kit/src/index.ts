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
} from './lib/primitives/shared/node.js';
export * from './lib/proposals/conflict-banner.js';
export * from './lib/proposals/field-proposal.js';
export * from './lib/proposals/restore-badge.js';
export * from './lib/proposals/restore-review-card.js';
export * from './lib/proposals/suggestions-bar.js';
export * from './lib/tokens.js';

export { StarterKitStyleProvider, starterKitDefaultStyles } from './lib/style-config.js';
export type { StarterKitStyleConfig, StarterKitStyleSlot } from './lib/style-config.js';

export { StarterKitSessionWorkbench } from './lib/ai/session-workbench.js';
export type {
  StarterKitCheckpointPreview,
  StarterKitSessionWorkbenchProps,
} from './lib/ai/session-workbench.js';
