import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ContinuumProvider,
  ContinuumRenderer,
  createAiConnectProviders,
  getAiConnectModelCatalog,
  type AiConnectClient,
  type AiConnectModelOption,
  type AiConnectProviderKind,
  type StarterKitCheckpointPreview,
  type StarterKitViewAuthoringFormat,
  StarterKitProviderChatBox,
  StarterKitSessionWorkbench,
  starterKitComponentMap,
  useContinuumSession,
  useContinuumSnapshot,
  type ViewDefinition,
} from '@continuum-dev/starter-kit-ai';
import { ExampleCard, ExampleGrid, PageSection, PageShell } from '../ui/layout';
import { repositoryUrl } from '../site-config';
import { SiteNav } from '../ui/site-nav';
import { useResponsiveState } from '../ui/responsive';
import { color, control, radius, space, type } from '../ui/tokens';

const LIVE_AI_STORAGE_KEY = 'continuum_demo_live_ai_settings_v1';
const LIVE_AI_SESSION_STORAGE_KEY = 'continuum_demo_live_ai_session_v1';

const liveView = {
  viewId: 'live-ai-demo',
  version: '1',
  nodes: [
    {
      id: 'welcome',
      type: 'group',
      label: 'Live AI Demo',
      children: [
        {
          id: 'welcome_intro',
          type: 'presentation',
          contentType: 'text',
          content:
            'Continuum contract starter: every generated screen should return a ViewDefinition with viewId, version, and nodes.',
        },
        {
          id: 'quick_start_grid',
          type: 'grid',
          columns: 3,
          children: [
            {
              id: 'quick_step_1',
              type: 'presentation',
              contentType: 'text',
              content: 'viewId: stable workflow id',
            },
            {
              id: 'quick_step_2',
              type: 'presentation',
              contentType: 'text',
              content: 'version: bump when structure changes',
            },
            {
              id: 'quick_step_3',
              type: 'presentation',
              contentType: 'text',
              content: 'nodes: supported Continuum node tree',
            },
          ],
        },
      ],
    },
  ],
} satisfies ViewDefinition;

const providerOptions: Array<{
  key: AiConnectProviderKind;
  label: string;
  tokenLabel: string;
}> = [
  {
    key: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
  },
  {
    key: 'anthropic',
    label: 'Anthropic Claude',
    tokenLabel: 'Anthropic API key',
  },
  {
    key: 'google',
    label: 'Google Gemini',
    tokenLabel: 'Google API key',
  },
];

type ProviderValueMap = Record<AiConnectProviderKind, string>;

interface LiveAiStoredSettings {
  provider?: AiConnectProviderKind;
  tokens?: Partial<ProviderValueMap>;
  models?: Partial<ProviderValueMap>;
  authoringFormat?: StarterKitViewAuthoringFormat;
}

const defaultProviderValues: ProviderValueMap = {
  openai: '',
  anthropic: '',
  google: '',
};

function createTokenRequiredProvider(label: string): AiConnectClient {
  return {
    id: 'token-required',
    label,
    kind: 'openai',
    defaultModel: 'token-required',
    supportsJsonSchema: false,
    async generate() {
      throw new Error('Add an access token above before running AI updates.');
    },
  };
}

function readStoredSettings(): LiveAiStoredSettings {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(LIVE_AI_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as LiveAiStoredSettings;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: space.lg,
};

const controlGroupStyle: CSSProperties = {
  display: 'grid',
  gap: space.sm,
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

const studioGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
  gap: space.lg,
  minWidth: 0,
  alignItems: 'start',
};

const chatPanelStyle: CSSProperties = {
  gridColumn: 'span 4 / span 4',
  display: 'grid',
  gap: space.md,
  minWidth: 0,
  alignSelf: 'start',
};

const previewPanelStyle: CSSProperties = {
  gridColumn: 'span 8 / span 8',
  display: 'grid',
  gap: space.md,
  minWidth: 0,
};

const panelShellStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
  alignContent: 'start',
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

const loadingBorderSvgStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  borderRadius: radius.md,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 10,
};

const helperTextStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
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

const sectionTitleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const previewOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  alignItems: 'start',
  alignContent: 'start',
  gap: space.md,
  padding: space.lg,
  background: 'rgba(243, 243, 241, 0.8)',
  backdropFilter: 'blur(2px)',
  borderRadius: radius.md,
  zIndex: 20,
};

const previewOverlayCardStyle: CSSProperties = {
  display: 'grid',
  gap: space.md,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
};

const overlayActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: space.sm,
  flexWrap: 'wrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  paddingBottom: space.sm,
  background: color.surface,
};

function LiveStudio({
  providers,
  hasToken,
  authoringFormat,
}: {
  providers: AiConnectClient[];
  hasToken: boolean;
  authoringFormat: StarterKitViewAuthoringFormat;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const [checkpointPreview, setCheckpointPreview] =
    useState<StarterKitCheckpointPreview | null>(null);
  const [clearCheckpointPreviewSignal, setClearCheckpointPreviewSignal] =
    useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { isMobile } = useResponsiveState();

  useEffect(() => {
    if (!snapshot) {
      session.pushView(liveView);
    }
  }, [session, snapshot]);

  const activeView = snapshot?.view ?? liveView;

  return (
    <div
      style={{
        ...studioGridStyle,
        gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : studioGridStyle.gridTemplateColumns,
      }}
    >
      <aside style={{ ...chatPanelStyle, gridColumn: isMobile ? '1 / -1' : chatPanelStyle.gridColumn }}>
        <div style={{ ...panelShellStyle, padding: isMobile ? space.md : panelShellStyle.padding }}>
          <div style={sectionTitleStyle}>AI chat</div>
          <StarterKitSessionWorkbench
            initialView={liveView}
            resetLabel="Reset form"
            showInlineCheckpointPreview={false}
            onCheckpointPreviewRequest={setCheckpointPreview}
            clearCheckpointPreviewSignal={clearCheckpointPreviewSignal}
          />
          <StarterKitProviderChatBox
            providers={providers}
            mode="evolve-view"
            authoringFormat={authoringFormat}
            instructionPlaceholder="Try: add a co-applicant section with employment and annual income fields."
            onSubmittingChange={setIsGenerating}
          />
          {!hasToken ? (
            <div style={helperTextStyle}>
              Add a token above before submitting your first prompt.
            </div>
          ) : null}
          <div style={{ height: space.xl }} />
        </div>
      </aside>

      <section
        style={{
          ...previewPanelStyle,
          gridColumn: isMobile ? '1 / -1' : previewPanelStyle.gridColumn,
        }}
      >
        <div style={{ ...panelShellStyle, padding: isMobile ? space.md : panelShellStyle.padding }}>
          <div style={sectionTitleStyle}>Generated view</div>
          <div style={helperTextStyle}>
            This panel intentionally takes more space so you can inspect structure, spacing, and behavior while iterating.
          </div>
          <div style={previewFrameStyle}>
            {isGenerating ? (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={loadingBorderSvgStyle}
                aria-hidden="true"
              >
                <rect
                  x="1"
                  y="1"
                  width="98"
                  height="98"
                  rx="4"
                  ry="4"
                  fill="none"
                  stroke={color.border}
                  strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x="1"
                  y="1"
                  width="98"
                  height="98"
                  rx="4"
                  ry="4"
                  fill="none"
                  stroke={color.accent}
                  strokeWidth="1.4"
                  strokeDasharray="44 360"
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-808"
                    dur="2.2s"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.42 0 0.58 1"
                    repeatCount="indefinite"
                  />
                </rect>
              </svg>
            ) : null}
            <ContinuumRenderer view={activeView} />
            {checkpointPreview ? (
              <div style={previewOverlayStyle}>
                <div style={previewOverlayCardStyle}>
                  <div style={sectionTitleStyle}>Checkpoint preview</div>
                  <div style={helperTextStyle}>
                    {checkpointPreview.label} ({checkpointPreview.trigger}) from{' '}
                    {new Date(checkpointPreview.timestamp).toLocaleString()}
                  </div>
                  <div style={overlayActionsStyle}>
                    <button
                      type="button"
                      style={{
                        ...inputStyle,
                        width: 'auto',
                        padding: `0 ${space.lg}px`,
                        background: color.accent,
                        color: color.surface,
                        border: `1px solid ${color.borderStrong}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        session.rewind(checkpointPreview.id);
                        setCheckpointPreview(null);
                        setClearCheckpointPreviewSignal((value) => value + 1);
                      }}
                    >
                      Confirm rewind
                    </button>
                    <button
                      type="button"
                      style={{
                        ...inputStyle,
                        width: 'auto',
                        padding: `0 ${space.lg}px`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setCheckpointPreview(null);
                        setClearCheckpointPreviewSignal((value) => value + 1);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <ContinuumRenderer view={checkpointPreview.snapshot.view} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LiveAiPage() {
  const stored = useMemo(() => readStoredSettings(), []);
  const [provider, setProvider] = useState<AiConnectProviderKind>(
    stored.provider ?? 'openai'
  );
  const [authoringFormat, setAuthoringFormat] =
    useState<StarterKitViewAuthoringFormat>(
      stored.authoringFormat ?? 'line-dsl'
    );
  const [tokensByProvider, setTokensByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(stored.tokens ?? {}),
  });
  const [modelsByProvider, setModelsByProvider] = useState<ProviderValueMap>({
    ...defaultProviderValues,
    ...(stored.models ?? {}),
  });

  const accessToken = tokensByProvider[provider] ?? '';
  const modelOptions = getAiConnectModelCatalog(provider);
  const rawModel = modelsByProvider[provider] ?? '';
  const model = modelOptions.some(
    (option: AiConnectModelOption) => option.id === rawModel
  )
    ? rawModel
    : '';

  const selectedProvider = providerOptions.find((item) => item.key === provider);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const payload: LiveAiStoredSettings = {
      provider,
      tokens: tokensByProvider,
      models: modelsByProvider,
      authoringFormat,
    };

    try {
      window.localStorage.setItem(LIVE_AI_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors in demo mode.
    }
  }, [authoringFormat, provider, tokensByProvider, modelsByProvider]);

  const hasToken = accessToken.trim().length > 0;

  const providers = useMemo(() => {
    const token = accessToken.trim();
    if (!token) {
      return [createTokenRequiredProvider(selectedProvider?.label ?? 'Provider')];
    }

    if (provider === 'openai') {
      return createAiConnectProviders({
        include: ['openai'],
        openai: {
          apiKey: token,
          ...(model.trim() ? { model: model.trim() } : {}),
        },
      });
    }

    if (provider === 'anthropic') {
      return createAiConnectProviders({
        include: ['anthropic'],
        anthropic: {
          apiKey: token,
          baseUrl: '/api/anthropic',
          ...(model.trim() ? { model: model.trim() } : {}),
        },
      });
    }

    return createAiConnectProviders({
      include: ['google'],
      google: {
        apiKey: token,
        ...(model.trim() ? { model: model.trim() } : {}),
      },
    });
  }, [accessToken, model, provider, selectedProvider]);
  const { isMobile } = useResponsiveState();

  return (
    <PageShell
      nav={<SiteNav />}
      eyebrow="Live AI Demo"
      title="Try Continuum live with your provider and token."
      description="Pick a provider, paste an access token, and evolve this starter view in real time. Provider settings are saved in your browser on this device."
    >
      <PageSection
        title="Provider setup"
        description="Use this top control grid to select your provider, drop in a token, and choose a model from curated provider-specific IDs."
      >
        <ExampleGrid alignItems="stretch">
          <ExampleCard
            title="Connection controls"
            description="These settings drive the headless ai-connect client used by the live studio below."
            span={12}
          >
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
                  value={provider}
                  onChange={(event) => {
                    setProvider(event.target.value as AiConnectProviderKind);
                  }}
                  style={inputStyle}
                >
                  {providerOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={controlGroupStyle}>
                <span style={fieldLabelStyle}>{selectedProvider?.tokenLabel ?? 'Access token'}</span>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(event) => {
                    setTokensByProvider((current) => ({
                      ...current,
                      [provider]: event.target.value,
                    }));
                  }}
                  placeholder="Paste token"
                  style={inputStyle}
                />
              </label>
              <label style={controlGroupStyle}>
                <span style={fieldLabelStyle}>Model</span>
                <select
                  value={model}
                  onChange={(event) => {
                    setModelsByProvider((current) => ({
                      ...current,
                      [provider]: event.target.value,
                    }));
                  }}
                  style={inputStyle}
                >
                  <option value="">Provider default</option>
                  {modelOptions.map((option: AiConnectModelOption) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={controlGroupStyle}>
                <span style={fieldLabelStyle}>Authoring format</span>
                <select
                  value={authoringFormat}
                  onChange={(event) => {
                    setAuthoringFormat(
                      event.target.value as StarterKitViewAuthoringFormat
                    );
                  }}
                  style={inputStyle}
                >
                  <option value="line-dsl">Line DSL</option>
                  <option value="yaml">Markdown YAML</option>
                </select>
              </label>
            </div>
            <div style={helperTextStyle}>
              Stored locally in this browser so you do not have to re-enter keys while testing. Model IDs are sourced from provider docs current on March 8, 2026. Line DSL is the default path. YAML stays available here for experiments.
            </div>
          </ExampleCard>
        </ExampleGrid>
      </PageSection>

      <PageSection
        title="Live studio"
        description="This Live AI Demo is built using the Starter Kit. Prompt on the left and watch the generated Continuum view evolve in a larger workspace on the right."
      >
        <div style={linkRowStyle}>
          <a href={repositoryUrl} target="_blank" rel="noreferrer" style={inlineLinkStyle}>
            View on GitHub
          </a>
          <a href="/docs" style={inlineLinkStyle}>
            Install / Read docs
          </a>
          <a href="/starter-kit" style={inlineLinkStyle}>
            Built with Starter Kit
          </a>
          <a href="/playground" style={inlineLinkStyle}>
            Prefer no API key? Try Static Demo
          </a>
        </div>
        <ContinuumProvider
          components={starterKitComponentMap}
          persist="localStorage"
          storageKey={LIVE_AI_SESSION_STORAGE_KEY}
        >
          <LiveStudio
            providers={providers}
            hasToken={hasToken}
            authoringFormat={authoringFormat}
          />
        </ContinuumProvider>
      </PageSection>
    </PageShell>
  );
}
