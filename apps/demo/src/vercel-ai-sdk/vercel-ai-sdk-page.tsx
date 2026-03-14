import type { CSSProperties, FocusEvent as ReactFocusEvent } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DefaultChatTransport } from 'ai';
import {
  applyContinuumViewPatch,
  ContinuumProvider,
  ContinuumRenderer,
  StarterKitChatBox,
  StarterKitSessionWorkbench,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/starter-kit';
import type { NodeValue, ViewDefinition } from '@continuum-dev/core';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { useResponsiveState } from '../ui/responsive';
import { color, control, radius, space, type } from '../ui/tokens';

const VERCEL_AI_SDK_SETTINGS_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_settings_v2';
const VERCEL_AI_SDK_SESSION_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_session_v1';
const VERCEL_AI_SDK_API_KEY_HEADER = 'x-demo-provider-api-key';

const demoPrompts = [
  'Make this feel mobile-first and less crowded.',
  'Add a household members section where someone can add multiple people.',
  'Turn this into a business lead form with company, budget, and timeline.',
  'Rework this into an urgent care patient intake flow with insurance and medications.',
];

const initialView = {
  viewId: 'vercel-ai-sdk-demo',
  version: 'baseline',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Contact profile',
      children: [
        {
          id: 'full_name',
          type: 'field',
          dataType: 'string',
          key: 'person.fullName',
          label: 'Full name',
          placeholder: 'Jordan Lee',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'person.email',
          label: 'Email',
          placeholder: 'jordan@example.com',
        },
        {
          id: 'phone',
          type: 'field',
          dataType: 'string',
          key: 'person.phone',
          label: 'Phone',
          placeholder: '(555) 555-5555',
        },
      ],
    },
    {
      id: 'request',
      type: 'group',
      key: 'request',
      label: 'What they need',
      children: [
        {
          id: 'goal',
          type: 'field',
          dataType: 'string',
          key: 'request.goal',
          label: 'Goal',
          placeholder: 'Describe what you need help with.',
        },
        {
          id: 'timeline',
          type: 'field',
          dataType: 'string',
          key: 'request.timeline',
          label: 'Timeline',
          placeholder: 'This month',
        },
      ],
    },
  ],
} satisfies ViewDefinition;

type DemoMode = 'mock' | 'live';
type DemoProviderId = 'openai' | 'anthropic';

interface DemoProviderOption {
  id: DemoProviderId;
  label: string;
  tokenLabel: string;
  defaultModel: string;
  models: string[];
  serverKeyAvailable: boolean;
}

interface ProvidersPayload {
  apiKeyHeader?: string;
  providers?: DemoProviderOption[];
}

interface DemoContinuumViewPart {
  type: 'data-continuum-view';
  data: {
    view: ViewDefinition;
  };
  transient?: boolean;
}

interface DemoContinuumStatePart {
  type: 'data-continuum-state';
  data: {
    nodeId: string;
    value: NodeValue;
  };
  transient?: boolean;
}

interface DemoContinuumPatchPart {
  type: 'data-continuum-patch';
  data: {
    patch: Parameters<typeof applyContinuumViewPatch>[1];
  };
  transient?: boolean;
}

interface DemoContinuumResetPart {
  type: 'data-continuum-reset';
  data: {
    reason?: string;
  };
  transient?: boolean;
}

interface DemoContinuumStatusPart {
  type: 'data-continuum-status';
  data: {
    status: string;
    level?: 'info' | 'success' | 'warning' | 'error';
  };
  transient?: boolean;
}

type DemoContinuumDataPart =
  | DemoContinuumViewPart
  | DemoContinuumPatchPart
  | DemoContinuumStatePart
  | DemoContinuumResetPart
  | DemoContinuumStatusPart;

type PreviewControlElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement;

interface StoredSettings {
  mode?: DemoMode;
  providerId?: DemoProviderId;
  apiKeys?: Partial<Record<DemoProviderId, string>>;
  models?: Partial<Record<DemoProviderId, string>>;
}

type ProviderValueMap = Record<DemoProviderId, string>;

const fallbackProviderCatalog: DemoProviderOption[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5-nano'],
    serverKeyAvailable: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    tokenLabel: 'Anthropic API key',
    defaultModel: 'claude-sonnet-4-6',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
    serverKeyAvailable: false,
  },
];

const defaultProviderValues: ProviderValueMap = {
  openai: '',
  anthropic: '',
};

const splitLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
  gap: space.lg,
  alignItems: 'start',
};

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const controlCardStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
};

const controlGroupStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const fieldLabelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const inputStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: control.height,
  padding: `0 ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  ...type.body,
};

const modeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
};

const modeButtonStyle: CSSProperties = {
  boxSizing: 'border-box',
  height: control.height,
  padding: `0 ${space.lg}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
  ...type.body,
  fontWeight: 600,
};

const previewFrameStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: space.lg,
  padding: space.xl,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,248,246,0.85) 100%)',
};

const pulseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: radius.md,
  border: `1px solid ${color.accentSoft}`,
  boxShadow: `0 0 0 1px rgba(184, 140, 84, 0.08) inset`,
  pointerEvents: 'none',
  animation: 'continuum-vercel-ai-sdk-pulse 2.2s ease-in-out infinite',
};

const helperTextStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const inlineNoteStyle: CSSProperties = {
  ...helperTextStyle,
  padding: space.md,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
};

const previewNoteStyle: CSSProperties = {
  ...helperTextStyle,
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.borderSoft}`,
  background: 'rgba(255, 248, 222, 0.9)',
  color: color.textSoft,
  width: 'fit-content',
};

const linkRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space.sm,
  marginBottom: space.md,
};

const inlineLinkStyle: CSSProperties = {
  ...type.small,
  color: color.text,
  textDecoration: 'none',
  padding: `${space.sm}px ${space.md}px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.surfaceMuted,
};

const chatLockWrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
};

const chatLockOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  alignItems: 'center',
  padding: space.lg,
  borderRadius: radius.lg,
  background: 'rgba(248, 248, 246, 0.82)',
  backdropFilter: 'blur(2px)',
};

const chatLockCardStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  boxShadow: '0 12px 28px rgba(19, 19, 18, 0.08)',
};

function readStoredSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(VERCEL_AI_SDK_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as StoredSettings;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeProvidersPayload(payload: unknown): DemoProviderOption[] | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const providers = (payload as ProvidersPayload).providers;
  if (!Array.isArray(providers)) {
    return null;
  }

  const normalized = providers.filter((provider): provider is DemoProviderOption => {
    if (!provider || typeof provider !== 'object') {
      return false;
    }

    const candidate = provider as Partial<DemoProviderOption>;
    return (
      (candidate.id === 'openai' || candidate.id === 'anthropic') &&
      typeof candidate.label === 'string' &&
      typeof candidate.tokenLabel === 'string' &&
      typeof candidate.defaultModel === 'string' &&
      Array.isArray(candidate.models) &&
      typeof candidate.serverKeyAvailable === 'boolean'
    );
  });

  return normalized.length > 0 ? normalized : null;
}

function isDemoContinuumDataPart(value: unknown): value is DemoContinuumDataPart {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as { type?: unknown; data?: unknown };
  return (
    typeof record.type === 'string' &&
    (record.type === 'data-continuum-view' ||
      record.type === 'data-continuum-patch' ||
      record.type === 'data-continuum-state' ||
      record.type === 'data-continuum-reset' ||
      record.type === 'data-continuum-status') &&
    'data' in record
  );
}

function isPreviewControlElement(
  element: Element | null
): element is PreviewControlElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function getApiKeyValidationMessage(rawValue: string): string | null {
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  if (/\s/.test(value)) {
    return 'This does not look like an API key. It contains whitespace, which usually means prompt text was pasted into the key field.';
  }

  if (value.length < 16) {
    return 'This value looks too short to be a provider API key.';
  }

  return null;
}

function Studio() {
  const storedSettings = useMemo(() => readStoredSettings(), []);
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewView, setPreviewView] = useState<ViewDefinition | null>(null);
  const [isPreviewTransient, setIsPreviewTransient] = useState(false);
  const [isPreviewInteractionPaused, setIsPreviewInteractionPaused] =
    useState(false);
  const [mode, setMode] = useState<DemoMode>(storedSettings.mode ?? 'mock');
  const [providerId, setProviderId] = useState<DemoProviderId>(
    storedSettings.providerId ?? 'openai'
  );
  const [apiKeysByProvider, setApiKeysByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(storedSettings.apiKeys ?? {}),
  });
  const [modelsByProvider, setModelsByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(storedSettings.models ?? {}),
  });
  const [providerCatalog, setProviderCatalog] =
    useState<DemoProviderOption[]>(fallbackProviderCatalog);
  const { isMobile } = useResponsiveState();
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewInteractionPausedRef = useRef(false);
  const queuedPreviewRef = useRef<{
    view: ViewDefinition;
    isTransient: boolean;
  } | null>(null);

  useEffect(() => {
    if (!snapshot) {
      session.pushView(initialView);
    }
  }, [session, snapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: StoredSettings = {
      mode,
      providerId,
      apiKeys: apiKeysByProvider,
      models: modelsByProvider,
    };

    try {
      window.localStorage.setItem(
        VERCEL_AI_SDK_SETTINGS_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore localStorage errors in the demo.
    }
  }, [apiKeysByProvider, mode, modelsByProvider, providerId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviderCatalog(): Promise<void> {
      try {
        const response = await fetch('/api/vercel-ai-sdk/providers');
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ProvidersPayload;
        const nextCatalog = normalizeProvidersPayload(payload);
        if (!cancelled && nextCatalog) {
          setProviderCatalog(nextCatalog);
        }
      } catch {
        // Fall back to the local catalog when the route is unavailable.
      }
    }

    void loadProviderCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeView = snapshot?.view ?? initialView;
  const latestViewRef = useRef<ViewDefinition>(activeView);

  useEffect(() => {
    latestViewRef.current = activeView;
  }, [activeView]);

  const selectedProvider =
    providerCatalog.find((provider) => provider.id === providerId) ??
    fallbackProviderCatalog[0];
  const activeApiKey = apiKeysByProvider[providerId] ?? '';
  const trimmedApiKey = activeApiKey.trim();
  const apiKeyValidationMessage = getApiKeyValidationMessage(activeApiKey);
  const hasUsableBrowserKey =
    trimmedApiKey.length > 0 && apiKeyValidationMessage === null;
  const selectedModel = modelsByProvider[providerId] ?? '';
  const resolvedModel = selectedModel.trim() || selectedProvider.defaultModel;
  const hasLiveAccess =
    selectedProvider.serverKeyAvailable || hasUsableBrowserKey;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api:
          mode === 'live'
            ? '/api/vercel-ai-sdk/chat'
            : '/api/vercel-ai-sdk/demo',
        headers: () => {
          const headers = new Headers();

          if (mode === 'live' && hasUsableBrowserKey) {
            headers.set(VERCEL_AI_SDK_API_KEY_HEADER, trimmedApiKey);
          }

          return headers;
        },
        body: () => ({
          providerId,
          model: resolvedModel,
          currentView: latestViewRef.current,
          currentData: session.getSnapshot()?.data.values ?? null,
        }),
      }),
    [hasUsableBrowserKey, mode, providerId, resolvedModel, session, trimmedApiKey]
  );

  const liveStatusText =
    mode === 'mock'
      ? 'Mock mode is deterministic and free. It shows the stream/session contract without asking for a key.'
      : apiKeyValidationMessage
        ? apiKeyValidationMessage
        : hasUsableBrowserKey
        ? 'Live mode will send your browser key to the Worker for this request only. The key stays in localStorage on this device.'
        : selectedProvider.serverKeyAvailable
          ? 'Live mode can use the Worker-configured provider secret. Add your own key if you want to override it.'
          : `Live mode is disabled until you add a ${selectedProvider.tokenLabel.toLowerCase()}.`;
  const isChatLocked = mode === 'live' && !hasLiveAccess;
  const chatRuntimeKey = [
    mode,
    providerId,
    resolvedModel,
    activeApiKey.trim(),
    selectedProvider.serverKeyAvailable ? 'env' : 'no-env',
  ].join(':');
  const hasQueuedPreview = queuedPreviewRef.current !== null;
  const previewStatusText = isGenerating || previewView
    ? isPreviewInteractionPaused
      ? hasQueuedPreview
        ? 'Streaming view updates are paused while you edit. Blur the field to apply the latest streamed change.'
        : 'You can type into the live streamed form. New structural updates will wait until you blur the field.'
      : isPreviewTransient
        ? 'Streaming draft view updates directly into the durable Continuum session.'
        : 'Applying the final streamed view into the durable Continuum session.'
    : null;

  const handleChatData = useCallback((part: unknown) => {
    if (!isDemoContinuumDataPart(part)) {
      return;
    }

    const isTransient = 'transient' in part && part.transient === true;

    if (part.type === 'data-continuum-view') {
      if (previewInteractionPausedRef.current) {
        queuedPreviewRef.current = {
          view: part.data.view,
          isTransient,
        };
        setPreviewView(part.data.view);
        setIsPreviewTransient(isTransient);
        return;
      }

      session.pushView(
        part.data.view,
        isTransient ? { transient: true } : undefined
      );
      setPreviewView(isTransient ? part.data.view : null);
      setIsPreviewTransient(isTransient);
      if (!isTransient) {
        queuedPreviewRef.current = null;
      }
      return;
    }

    if (part.type === 'data-continuum-patch') {
      const currentView = session.getSnapshot()?.view ?? latestViewRef.current;
      const nextView = applyContinuumViewPatch(currentView, part.data.patch);

      if (previewInteractionPausedRef.current) {
        queuedPreviewRef.current = {
          view: nextView,
          isTransient,
        };
        setPreviewView(nextView);
        setIsPreviewTransient(isTransient);
        return;
      }

      session.pushView(nextView, isTransient ? { transient: true } : undefined);
      setPreviewView(isTransient ? nextView : null);
      setIsPreviewTransient(isTransient);
      if (!isTransient) {
        queuedPreviewRef.current = null;
      }
      return;
    }

    if (part.type === 'data-continuum-state') {
      session.proposeValue(part.data.nodeId, part.data.value, 'vercel-ai-sdk');
      return;
    }

    if (!isTransient && part.type === 'data-continuum-reset') {
      session.reset();
      queuedPreviewRef.current = null;
      setPreviewView(null);
      setIsPreviewTransient(false);
      return;
    }

    if (
      !isTransient &&
      part.type === 'data-continuum-status' &&
      part.data.level === 'error'
    ) {
      queuedPreviewRef.current = null;
      setPreviewView(null);
      setIsPreviewTransient(false);
      previewInteractionPausedRef.current = false;
      setIsPreviewInteractionPaused(false);
    }
  }, [session]);

  const flushQueuedPreview = useCallback(() => {
    const queuedPreview = queuedPreviewRef.current;
    if (!queuedPreview) {
      return;
    }

    queuedPreviewRef.current = null;
    session.pushView(
      queuedPreview.view,
      queuedPreview.isTransient ? { transient: true } : undefined
    );
    setPreviewView(queuedPreview.isTransient ? queuedPreview.view : null);
    setIsPreviewTransient(queuedPreview.isTransient);
  }, [session]);

  const handlePreviewFocusCapture = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      if (!isGenerating || !isPreviewControlElement(event.target as Element | null)) {
        return;
      }

      previewInteractionPausedRef.current = true;
      setIsPreviewInteractionPaused(true);
    },
    [isGenerating]
  );

  const handlePreviewBlurCapture = useCallback(
    (event: ReactFocusEvent<HTMLDivElement>) => {
      if (!isPreviewInteractionPaused) {
        return;
      }

      const container = previewFrameRef.current;
      const nextTarget = event.relatedTarget;
      const nextPreviewControl =
        container &&
        nextTarget instanceof Element &&
        container.contains(nextTarget) &&
        isPreviewControlElement(nextTarget)
          ? nextTarget
          : null;

      if (nextPreviewControl) {
        return;
      }

      previewInteractionPausedRef.current = false;
      setIsPreviewInteractionPaused(false);
      flushQueuedPreview();
    },
    [flushQueuedPreview, isPreviewInteractionPaused]
  );

  const handleSubmittingChange = useCallback((nextIsSubmitting: boolean) => {
    setIsGenerating(nextIsSubmitting);

    if (nextIsSubmitting) {
      queuedPreviewRef.current = null;
      setPreviewView(null);
      setIsPreviewTransient(false);
      previewInteractionPausedRef.current = false;
      setIsPreviewInteractionPaused(false);
      return;
    }

    if (!previewInteractionPausedRef.current) {
      setPreviewView(null);
      setIsPreviewTransient(false);
    }
  }, []);

  const handleChatError = useCallback(() => {
    queuedPreviewRef.current = null;
    setPreviewView(null);
    setIsPreviewTransient(false);
    previewInteractionPausedRef.current = false;
    setIsPreviewInteractionPaused(false);
  }, []);

  return (
    <>
      <style>
        {`@keyframes continuum-vercel-ai-sdk-pulse {
          0% { opacity: 0.08; transform: scale(0.999); }
          50% { opacity: 0.22; transform: scale(1); }
          100% { opacity: 0.08; transform: scale(0.999); }
        }

        @keyframes continuum-vercel-ai-sdk-soft-enter {
          0% {
            opacity: 0;
            clip-path: inset(0 0 100% 0);
          }
          65% {
            opacity: 0.82;
          }
          100% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
        }

        @keyframes continuum-vercel-ai-sdk-soft-reveal {
          0% {
            opacity: 0;
            clip-path: inset(0 0 100% 0);
          }
          70% {
            opacity: 0.88;
          }
          100% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
        }

        [data-continuum-animated] {
          animation: continuum-vercel-ai-sdk-soft-enter var(--continuum-enter-duration, 560ms) cubic-bezier(0.2, 0.72, 0.18, 1) both;
          animation-delay: var(--continuum-enter-delay, 0ms);
          will-change: opacity, clip-path;
          backface-visibility: hidden;
        }

        [data-continuum-animated="container"],
        [data-continuum-animated="field"],
        [data-continuum-animated="action"],
        [data-continuum-animated="presentation"] {
          animation: none;
          opacity: 1;
          clip-path: none;
          will-change: auto;
        }

        [data-continuum-animated-child] {
          animation: continuum-vercel-ai-sdk-soft-reveal var(--continuum-enter-duration, 760ms) cubic-bezier(0.2, 0.72, 0.18, 1) both;
          animation-delay: var(--continuum-enter-delay, 0ms);
          will-change: opacity, clip-path;
          backface-visibility: hidden;
        }

        @media (prefers-reduced-motion: reduce) {
          [data-continuum-animated],
          [data-continuum-animated-child] {
            animation: none;
          }
        }`}
      </style>
      <div
        style={{
          ...splitLayoutStyle,
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : splitLayoutStyle.gridTemplateColumns,
        }}
      >
        <aside style={panelStyle}>
          <div style={{ ...type.section, color: color.text }}>
            Driver-based chat
          </div>
          <div style={helperTextStyle}>
            `apps/demo` keeps the session and reconciliation loop in the
            browser. `apps/demo-api` is the explicit Worker boundary that talks
            to Vercel AI SDK providers and streams data parts back.
          </div>

          <div style={controlCardStyle}>
            <div style={{ ...type.label, color: color.textSoft }}>
              Transport mode
            </div>
            <div style={modeRowStyle}>
              <button
                type="button"
                onClick={() => {
                  setMode('mock');
                }}
                aria-pressed={mode === 'mock'}
                style={{
                  ...modeButtonStyle,
                  background: mode === 'mock' ? color.accent : modeButtonStyle.background,
                  color: mode === 'mock' ? color.surface : modeButtonStyle.color,
                  border:
                    mode === 'mock'
                      ? `1px solid ${color.borderStrong}`
                      : modeButtonStyle.border,
                }}
              >
                Mock demo
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('live');
                }}
                aria-pressed={mode === 'live'}
                style={{
                  ...modeButtonStyle,
                  background: mode === 'live' ? color.accent : modeButtonStyle.background,
                  color: mode === 'live' ? color.surface : modeButtonStyle.color,
                  border:
                    mode === 'live'
                      ? `1px solid ${color.borderStrong}`
                      : modeButtonStyle.border,
                }}
              >
                Live BYOK
              </button>
            </div>

            {mode === 'live' ? (
              <div
                style={{
                  ...controlGridStyle,
                  gridTemplateColumns: isMobile
                    ? 'minmax(0, 1fr)'
                    : controlGridStyle.gridTemplateColumns,
                }}
              >
                <label style={controlGroupStyle}>
                  <span style={fieldLabelStyle}>Provider</span>
                  <select
                    value={providerId}
                    onChange={(event) => {
                      setProviderId(event.target.value as DemoProviderId);
                    }}
                    style={inputStyle}
                  >
                    {providerCatalog.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={controlGroupStyle}>
                  <span style={fieldLabelStyle}>{selectedProvider.tokenLabel}</span>
                  <input
                    type="password"
                    value={activeApiKey}
                    onChange={(event) => {
                      setApiKeysByProvider((current) => ({
                        ...current,
                        [providerId]: event.target.value,
                      }));
                    }}
                    placeholder={
                      selectedProvider.serverKeyAvailable
                        ? 'Optional override'
                        : 'Paste key'
                    }
                    style={{
                      ...inputStyle,
                      border:
                        apiKeyValidationMessage && mode === 'live'
                          ? `1px solid ${color.danger ?? '#c25b56'}`
                          : inputStyle.border,
                    }}
                  />
                </label>

                <label style={controlGroupStyle}>
                  <span style={fieldLabelStyle}>Model</span>
                  <select
                    value={selectedModel}
                    onChange={(event) => {
                      setModelsByProvider((current) => ({
                        ...current,
                        [providerId]: event.target.value,
                      }));
                    }}
                    style={inputStyle}
                  >
                    <option value="">
                      Provider default ({selectedProvider.defaultModel})
                    </option>
                    {selectedProvider.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            <div style={inlineNoteStyle}>{liveStatusText}</div>
          </div>

          <StarterKitSessionWorkbench
            initialView={initialView}
            resetLabel="Reset session"
          />
          <div style={chatLockWrapperStyle}>
            <StarterKitChatBox
              key={chatRuntimeKey}
              driver={{
                kind: 'vercel-ai-sdk',
                props: {
                  chatOptions: {
                    transport,
                    autoApplyMessages: false,
                    onData: handleChatData,
                  },
                  instructionPlaceholder:
                    mode === 'live'
                      ? 'Try: turn this into a business lead form with company, budget, and timeline.'
                      : 'Try: make this mobile-first and add a household members section.',
                  enableSuggestedPrompts: true,
                  suggestedPrompts: demoPrompts,
                  onError: handleChatError,
                  onSubmittingChange: handleSubmittingChange,
                },
              }}
            />
            {isChatLocked ? (
              <div style={chatLockOverlayStyle}>
                <div style={chatLockCardStyle}>
                  <div style={{ ...type.section, color: color.text }}>
                    Live chat locked
                  </div>
                  <div style={helperTextStyle}>
                    Add a provider key above to unlock real Vercel AI SDK requests.
                    Mock mode is still available if you just want to inspect the
                    Continuum session flow.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section style={panelStyle}>
          <div style={{ ...type.section, color: color.text }}>
            Generated Continuum view
          </div>
          <div style={helperTextStyle}>
            Type into a few fields first. Then change the structure. Continuum
            still owns continuity after the Vercel AI SDK stream lands, so the
            stable semantic fields keep their values.
          </div>
          <div
            ref={previewFrameRef}
            style={previewFrameStyle}
            onFocusCapture={handlePreviewFocusCapture}
            onBlurCapture={handlePreviewBlurCapture}
          >
            {previewStatusText ? (
              <div style={previewNoteStyle}>{previewStatusText}</div>
            ) : null}
            {isGenerating ? <div style={pulseStyle} aria-hidden="true" /> : null}
            <ContinuumRenderer view={activeView} />
          </div>
        </section>
      </div>
    </>
  );
}

export function VercelAiSdkPage() {
  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Vercel AI SDK Demo"
      title="Keep Vercel AI SDK. Let Continuum own the runtime after the stream."
      description="This demo now has an explicit Cloudflare Worker API boundary for mock and live Vercel AI SDK streams. The SDK handles transport. Continuum handles reconciliation, checkpoints, and continuity on the client."
    >
      <PageSection
        title="Why this integration exists"
        description="Vercel AI SDK users already have hooks, transports, and tool loops. Continuum gives them the runtime layer they need when generated UI stops being disposable."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Keep existing AI SDK habits"
            description="The demo speaks the Vercel AI SDK stream protocol from an explicit Worker route. Continuum does not replace `useChat`; it plugs into the session after data parts arrive."
            span={4}
          >
            <div style={helperTextStyle}>
              Existing Vercel chat loops stay recognizable.
            </div>
          </ExampleCard>
          <ExampleCard
            title="Preserve real user work"
            description="When the generated form changes shape, Continuum reconciles the new view against the live session so typed values and history survive."
            span={4}
          >
            <div style={helperTextStyle}>
              Stable semantic keys keep in-progress values attached.
            </div>
          </ExampleCard>
          <ExampleCard
            title="Keep the server honest"
            description="Mock mode is explicit. Live mode is explicit. The client stays the reconciliation engine, and the Worker just streams provider output plus Continuum data parts."
            span={4}
          >
            <div style={helperTextStyle}>
              No more fake live responses pretending to be model-backed.
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>

      <PageSection
        title="Live demo"
        description="Prompt on the left, inspect the evolving view on the right, and use the session workbench to rewind changes. Mock mode stays deterministic. Live mode uses BYOK or a Worker secret if you configure one privately."
      >
        <div style={linkRowStyle}>
          <a href={repositoryUrl} target="_blank" rel="noreferrer" style={inlineLinkStyle}>
            View on GitHub
          </a>
          <a href="/docs" style={inlineLinkStyle}>
            Install / Read docs
          </a>
          <a href="/live-ai" style={inlineLinkStyle}>
            Provider chat demo
          </a>
          <a href="/playground" style={inlineLinkStyle}>
            Static continuity demo
          </a>
        </div>
        <ContinuumProvider
          components={starterKitComponentMap}
          persist="localStorage"
          storageKey={VERCEL_AI_SDK_SESSION_STORAGE_KEY}
        >
          <Studio />
        </ContinuumProvider>
      </PageSection>
    </PageShell>
  );
}
