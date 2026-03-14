export { ContinuumProvider, ContinuumRenderer } from '@continuum-dev/react';
export * from '@continuum-dev/core';
export {
  getAiConnectModelCatalog,
  type AiConnectClient,
  type AiConnectModelOption,
} from '@continuum-dev/ai-connect';
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
export type { StarterKitProviderChatBoxProps } from './lib/ai/provider-chat-box.js';
export { StarterKitVercelAiSdkChatBox } from './lib/ai/vercel-ai-sdk-chat-box.js';
export type { StarterKitVercelAiSdkChatBoxProps } from './lib/ai/vercel-ai-sdk-chat-box.js';
export { StarterKitChatBox } from './lib/ai/chat-box.js';
export type { StarterKitChatBoxDriver, StarterKitChatBoxProps } from './lib/ai/chat-box.js';
export type { StarterKitViewAuthoringFormat } from './lib/ai/view-authoring.js';
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
export {
  createStarterKitAnthropicProvider,
  createStarterKitGoogleProvider,
  createStarterKitOpenAiProvider,
} from './lib/ai/providers/index.js';
export type {
  StarterKitAnthropicProviderConfig,
  StarterKitGoogleProviderConfig,
  StarterKitOpenAiProviderConfig,
} from './lib/ai/providers/index.js';
