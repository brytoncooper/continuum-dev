import type {
  ContinuumTransformPlan,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/core';
import type {
  ActionRegistration,
  ContinuumEditExemplarTrace,
  ScopedEditBrief,
  ViewEvolutionDiagnostics,
} from '@continuum-dev/protocol';
import type {
  DetachedFieldHint,
  PromptAddon,
  PromptMode,
  PromptOutputContract,
} from '@continuum-dev/prompts';
import type { ContinuumStateUpdate } from '../execution-targets/index.js';
import type { ContinuumExecutionMode, ContinuumExecutionPlan } from './planner-types.js';
import type { ContinuumViewAuthoringFormat } from '../view-authoring/index.js';
import type { ViewPatchPlan } from '../view-patching/index.js';

export type ContinuumExecutionPhase =
  | 'planner'
  | 'state'
  | 'patch'
  | 'transform'
  | 'view'
  | 'repair';

export type ContinuumExecutionOutputKind = 'text' | 'json-object';

export type ContinuumExecutionStatusLevel =
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

/**
 * Binary payload for a single user-attached image or document, aligned with
 * AI SDK user message parts (`image` / `file`). `base64` is raw base64 (no
 * `data:` prefix). Used when forwarding chat attachments into model calls.
 */
export type ContinuumChatAttachment =
  | {
      kind: 'image';
      mediaType: string;
      base64: string;
      filename?: string;
    }
  | {
      kind: 'file';
      mediaType: string;
      base64: string;
      filename?: string;
    };

export interface ContinuumExecutionRequest {
  systemPrompt: string;
  userMessage: string;
  mode: ContinuumExecutionPhase;
  /**
   * Hint for hosts and traces about how the adapter should shape the model
   * reply. **`outputContract` is the real structured-output knob**: when set,
   * transports that support JSON schema (for example `@continuum-dev/ai-connect`)
   * attach it to the provider request. `outputKind` does not enforce structure
   * by itself.
   */
  outputKind?: ContinuumExecutionOutputKind;
  /** When set, structured-output transports forward this contract to the provider. */
  outputContract?: PromptOutputContract;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  providerOptions?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  /**
   * Optional multimodal parts (same turn as `userMessage`), forwarded to the
   * execution adapter when supported.
   */
  attachments?: ContinuumChatAttachment[];
}

export interface ContinuumExecutionResponse {
  text: string;
  json?: unknown | null;
  raw?: unknown;
  /**
   * When true, a structured-output transport retried the call without
   * `outputContract` after the provider rejected the schema (best-effort JSON
   * parsed from `text`). Absent or false means no such fallback occurred.
   */
  outputContractFallbackUsed?: boolean;
}

export interface ContinuumExecutionAdapter {
  label: string;
  generate(
    request: ContinuumExecutionRequest
  ): Promise<ContinuumExecutionResponse>;
  streamText?(request: ContinuumExecutionRequest): AsyncIterable<string>;
  streamObject?(request: ContinuumExecutionRequest): AsyncIterable<unknown>;
}

/**
 * One pretend REST endpoint and the fields the product persists for it.
 * `semanticKey` values align with Continuum view `semanticKey` / field keys.
 *
 * Use `shape` to describe structured payloads:
 * - **`scalar`** (default): one column / scalar body property.
 * - **`object`**: nested group; only `fields` contribute allowed semantic keys (not the parent key).
 * - **`collection`**: repeating rows; the collection key plus every `itemFields` key are allowed.
 */
export interface ContinuumIntegrationPersistedField {
  semanticKey: string;
  label: string;
  required: boolean;
  dataType?: string;
  shape?: 'scalar' | 'object' | 'collection';
  /** When `shape` is `object`, nested persisted columns (leaf keys only). */
  fields?: ContinuumIntegrationPersistedField[];
  /** When `shape` is `collection`, schema for one row (Continuum collection template). */
  itemFields?: ContinuumIntegrationPersistedField[];
  minItems?: number;
  maxItems?: number;
  description?: string;
  /** Constrained string domain for planner and UI (e.g. risk band). */
  enumValues?: string[];
}

/**
 * One logical write: HTTP surface plus the **persisted payload shape** for
 * that call. `persistedFields` are database/request columns, not a form layout.
 */
export interface ContinuumIntegrationEndpoint {
  id: string;
  method: string;
  path: string;
  description: string;
  userAction: string;
  persistedFields: ContinuumIntegrationPersistedField[];
}

/**
 * Optional integration catalog: product blurb plus per-endpoint **payload
 * schemas** (persisted fields). This documents what the backend accepts; it
 * does not prescribe a default form. When present, the planner may emit
 * `endpointId` and `payloadSemanticKeys`, and view generation is constrained
 * to those semantic keys for persisted data.
 */
export interface ContinuumIntegrationCatalog {
  productSummary: string;
  endpoints: ContinuumIntegrationEndpoint[];
}

/**
 * Snapshot of `Session.getRegisteredActions()` for prompts: intent id → display
 * metadata. Not a runtime handler map.
 */
export type ContinuumRegisteredActions = Record<string, ActionRegistration>;

export interface ContinuumExecutionContext {
  currentView?: ViewDefinition;
  currentData?: Record<string, NodeValue | undefined>;
  detachedFields?: DetachedFieldHint[];
  /**
   * Bounded, caller-supplied text (for example recent user-visible turns) so
   * referential follow-ups can be interpreted against prior intent.
   */
  conversationSummary?: string;
  issues?: unknown[];
  /**
   * Optional simulated backend/endpoints catalog for demos; forwarded from the
   * host app when the session should stay within declared persisted fields.
   */
  integrationCatalog?: ContinuumIntegrationCatalog;
  /**
   * Action intents registered on the Continuum session (`getRegisteredActions`).
   * The model should use these `intentId` values on `action` nodes when wiring
   * buttons to real client handlers.
   */
  registeredActions?: ContinuumRegisteredActions;
  /**
   * Files from the current chat turn (images, PDFs), merged into each
   * `ContinuumExecutionRequest` for that run when the adapter supports multimodal input.
   */
  chatAttachments?: ContinuumChatAttachment[];
}

/**
 * Inputs for `streamContinuumExecution`. Initial view authoring may stream a
 * full text document; follow-up edits can later move toward smaller patch and
 * state events once that path is validated in product.
 */
export interface StreamContinuumExecutionArgs {
  adapter: ContinuumExecutionAdapter;
  instruction: string;
  context?: ContinuumExecutionContext;
  /**
   * View authoring prompt mode (`create-view`, `evolve-view`, etc.). Does not
   * select execution phase; use {@link executionMode} or {@link executionPlan}
   * for state/patch/transform/view routing.
   */
  mode?: PromptMode;
  /**
   * Explicit OSS execution phase. Omitted means default full view generation.
   * Ignored when {@link executionPlan} is set.
   */
  executionMode?: ContinuumExecutionMode;
  /**
   * Explicit execution plan (advanced). Takes precedence over
   * {@link executionMode}.
   */
  executionPlan?: ContinuumExecutionPlan;
  addons?: PromptAddon[];
  outputContract?: PromptOutputContract;
  authoringFormat?: ContinuumViewAuthoringFormat;
  autoApplyView?: boolean;
  /**
   * When false, view authoring does not emit `view-preview` events; only
   * `view-final` is emitted after generation completes.
   */
  emitViewPreviews?: boolean;
  /**
   * Minimum time between `view-preview` events after the first preview. The
   * first distinct preview still emits immediately. Defaults to `600` ms. Use
   * `0` to emit on every distinct parsed snapshot (maximum SSE volume).
   */
  viewPreviewThrottleMs?: number;
  /**
   * Optional scoped edit contract from a host or premium planner. OSS does not
   * infer this; it is forwarded into traces and future prompt wiring only.
   */
  scopedEditBrief?: ScopedEditBrief;
  /**
   * Optional hook for persisting accepted or rejected edit exemplars (product
   * or cloud). Invoked after runtime evaluation for explicit patch/transform
   * paths when diagnostics are available.
   */
  onEditTrace?: (trace: ContinuumEditExemplarTrace) => void;
}

export interface ContinuumExecutionTraceEntry {
  phase: ContinuumExecutionPhase;
  request: ContinuumExecutionRequest;
  response: ContinuumExecutionResponse;
}

interface ContinuumExecutionFinalResultBase {
  source: string;
  status: string;
  level: ContinuumExecutionStatusLevel;
  trace: ContinuumExecutionTraceEntry[];
}

export interface ContinuumStateExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'state';
  currentView: ViewDefinition;
  updates: ContinuumStateUpdate[];
  parsed: {
    updates: ContinuumStateUpdate[];
    status?: string;
  };
}

export interface ContinuumPatchExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'patch';
  currentView: ViewDefinition;
  patchPlan: ViewPatchPlan;
  parsed: ViewPatchPlan;
  viewEvolutionDiagnostics?: ViewEvolutionDiagnostics;
}

export interface ContinuumViewExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'view';
  view: ViewDefinition;
  parsed: ViewDefinition;
  viewEvolutionDiagnostics?: ViewEvolutionDiagnostics;
}

export interface ContinuumTransformExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'transform';
  view: ViewDefinition;
  transformPlan: ContinuumTransformPlan;
  parsed: {
    view: ViewDefinition;
    transformPlan: ContinuumTransformPlan;
  };
  viewEvolutionDiagnostics?: ViewEvolutionDiagnostics;
}

export interface ContinuumNoopExecutionFinalResult
  extends ContinuumExecutionFinalResultBase {
  mode: 'noop';
  requestedMode: 'state' | 'patch' | 'transform' | 'view';
  reason: string;
}

export type ContinuumExecutionFinalResult =
  | ContinuumStateExecutionFinalResult
  | ContinuumPatchExecutionFinalResult
  | ContinuumTransformExecutionFinalResult
  | ContinuumViewExecutionFinalResult
  | ContinuumNoopExecutionFinalResult;

export type ContinuumExecutionEvent =
  | {
      kind: 'status';
      status: string;
      level: ContinuumExecutionStatusLevel;
    }
  | {
      kind: 'state';
      currentView: ViewDefinition;
      update: ContinuumStateUpdate;
    }
  | {
      kind: 'patch';
      currentView: ViewDefinition;
      patchPlan: ViewPatchPlan;
    }
  | {
      kind: 'view-preview';
      view: ViewDefinition;
    }
  | {
      kind: 'view-final';
      view: ViewDefinition;
      transformPlan?: ContinuumTransformPlan;
    }
  | {
      kind: 'error';
      message: string;
      error: Error;
    };
