import type { ViewDefinition } from '@continuum-dev/core';
import type { DefaultChatTransport } from 'ai';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContinuumVercelAiSdkMessage } from '@continuum-dev/starter-kit-ai';
import { VercelAiSdkControlsPanel } from './vercel-ai-sdk-controls-panel';
import type { UseVercelAiSdkDemoSettingsResult } from '../hooks/use-vercel-ai-sdk-demo-settings';

vi.mock('@continuum-dev/starter-kit-ai', () => ({
  StarterKitChatBox: () => <div>Chat box</div>,
  StarterKitSessionWorkbench: ({
    resetLabel,
  }: {
    resetLabel?: string;
    children?: ReactNode;
  }) => <div>{resetLabel ?? 'Form Reset'}</div>,
}));

const initialView: ViewDefinition = {
  viewId: 'test-view',
  version: '1',
  nodes: [],
};

const settings: UseVercelAiSdkDemoSettingsResult = {
  providerId: 'openai',
  providerCatalog: [
    {
      id: 'openai',
      label: 'OpenAI',
      tokenLabel: 'OpenAI API key',
      defaultModel: 'gpt-5.4',
      models: ['gpt-5.4'],
      serverKeyAvailable: false,
    },
  ],
  selectedProvider: {
    id: 'openai',
    label: 'OpenAI',
    tokenLabel: 'OpenAI API key',
    defaultModel: 'gpt-5.4',
    models: ['gpt-5.4'],
    serverKeyAvailable: false,
  },
  activeApiKey: '',
  trimmedApiKey: '',
  selectedModel: '',
  resolvedModel: 'gpt-5.4',
  apiKeyValidationMessage: null,
  hasUsableBrowserKey: false,
  hasLiveAccess: false,
  isChatLocked: true,
  liveStatusText: 'Paste your openai api key to unlock the live demo.',
  setProviderId: vi.fn(),
  setApiKey: vi.fn(),
  setModel: vi.fn(),
};

describe('VercelAiSdkControlsPanel', () => {
  it('uses a live-only, key-first setup', () => {
    const html = renderToStaticMarkup(
      <VercelAiSdkControlsPanel
        initialView={initialView}
        isMobile={false}
        settings={settings}
        chatRuntimeKey="openai:gpt-5.4:"
        transport={{} as DefaultChatTransport<ContinuumVercelAiSdkMessage>}
        debugEcho={false}
        onDebugEchoChange={vi.fn()}
        onSubmittingChange={vi.fn()}
        onError={vi.fn()}
      />
    );

    expect(html).toContain('Provider');
    expect(html).toContain('OpenAI API key');
    expect(html).toContain('GPT-5.4');
    expect(html).toContain('Add stable Continuum state to Vercel AI SDK');
    expect(html).toContain('Form Reset');
    expect(html).toContain('Add a key to continue');
    expect(html).not.toContain('Mock demo');
    expect(html).not.toContain('Live BYOK');
  });
});
