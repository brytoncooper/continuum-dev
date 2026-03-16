import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AiConnectClient } from '@continuum-dev/ai-connect';
import {
  useProviderChatController,
  type ProviderChatControllerState,
} from './use-provider-chat-controller.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const aiEngineMocks = vi.hoisted(() => {
  const sessionAdapter = {
    sessionId: 'session-1',
  };

  return {
    sessionAdapter,
    createStarterKitSessionAdapter: vi.fn(() => sessionAdapter),
    runStarterKitViewGeneration: vi.fn(async () => ({
      result: {
        providerId: 'openai',
        model: 'gpt-5',
        text: '',
        json: null,
        raw: null,
      },
      parsed: { ok: true },
      status: 'Applied update',
    })),
  };
});

vi.mock('@continuum-dev/react', () => ({
  useContinuumSession: () => ({
    sessionId: 'session-1',
  }),
}));

vi.mock('@continuum-dev/ai-engine', () => ({
  createStarterKitSessionAdapter: aiEngineMocks.createStarterKitSessionAdapter,
  runStarterKitViewGeneration: aiEngineMocks.runStarterKitViewGeneration,
}));

describe('@continuum-dev/starter-kit-ai/useProviderChatController', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: ProviderChatControllerState | null = null;

  const providers: AiConnectClient[] = [
    {
      id: 'openai',
      label: 'OpenAI',
      kind: 'openai',
      defaultModel: 'gpt-5',
      supportsJsonSchema: true,
      async generate() {
        throw new Error('not used');
      },
    },
  ];

  function Harness() {
    controller = useProviderChatController({
      providers,
    });

    return null;
  }

  beforeEach(async () => {
    controller = null;
    aiEngineMocks.runStarterKitViewGeneration.mockClear();
    container = document.createElement('div');
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
  });

  it('delegates generation to ai-engine instead of inlining orchestration logic', async () => {
    expect(controller).not.toBeNull();

    act(() => {
      controller?.setInstruction('Add a co-applicant section');
    });

    await act(async () => {
      await controller?.submit();
    });

    expect(aiEngineMocks.runStarterKitViewGeneration).toHaveBeenCalledTimes(1);
    expect(aiEngineMocks.runStarterKitViewGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: providers[0],
        session: aiEngineMocks.sessionAdapter,
        instruction: 'Add a co-applicant section',
        mode: 'evolve-view',
      })
    );
    expect(controller?.status).toBe('Applied update');
  });
});
