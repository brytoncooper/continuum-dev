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
  useContinuumSession,
  useContinuumSnapshot,
  useContinuumState,
  useContinuumSuggestions,
  useContinuumViewport,
} from '@continuum-dev/react';
export * from '@continuum-dev/prompts';
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
export * from './lib/proposals/suggestions-bar.js';
export * from './lib/tokens.js';

export { StarterKitStyleProvider, starterKitDefaultStyles } from './lib/style-config.js';
export type { StarterKitStyleConfig, StarterKitStyleSlot } from './lib/style-config.js';

export { StarterKitProviderChatBox } from './lib/ai/provider-chat-box.js';
export { StarterKitSessionWorkbench } from './lib/ai/session-workbench.js';
export type { StarterKitCheckpointPreview } from './lib/ai/session-workbench.js';
export {
  StarterKitProviderComposer,
  createStarterKitProviders,
} from './lib/ai/provider-composer.js';
export type {
  StarterKitProviderComposerArgs,
  StarterKitProviderKey,
} from './lib/ai/provider-composer.js';
