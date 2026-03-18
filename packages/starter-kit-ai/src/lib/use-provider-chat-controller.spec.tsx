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
    getSnapshot: vi.fn(() => null),
    getDetachedValues: vi.fn(() => ({})),
    getIssues: vi.fn(() => []),
    applyView: vi.fn(),
    proposeValue: vi.fn(),
  };

  return {
    sessionAdapter,
    createContinuumSessionAdapter: vi.fn(() => sessionAdapter),
    buildContinuumExecutionContext: vi.fn(() => ({
      currentView: undefined,
      currentData: {},
      detachedFields: [],
      issues: [],
    })),
    runContinuumExecution: vi.fn(async () => ({
      mode: 'view',
      source: 'OpenAI',
      trace: [
        {
          phase: 'view',
          request: {
            systemPrompt: '',
            userMessage: '',
            mode: 'view',
          },
          response: {
            text: '',
            json: null,
            raw: {
              providerId: 'openai',
              model: 'gpt-5',
              text: '',
              json: null,
              raw: null,
            },
          },
        },
      ],
      parsed: { ok: true },
      view: {
        viewId: 'generated',
        version: '1',
        nodes: [],
      },
      status: 'Applied update',
    })),
    applyContinuumExecutionFinalResult: vi.fn(),
  };
});

vi.mock('@continuum-dev/react', () => ({
  useContinuumSession: () => ({
    sessionId: 'session-1',
  }),
}));

vi.mock('@continuum-dev/ai-engine', () => ({
  createContinuumSessionAdapter: aiEngineMocks.createContinuumSessionAdapter,
  buildContinuumExecutionContext: aiEngineMocks.buildContinuumExecutionContext,
  runContinuumExecution: aiEngineMocks.runContinuumExecution,
  applyContinuumExecutionFinalResult:
    aiEngineMocks.applyContinuumExecutionFinalResult,
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
    aiEngineMocks.runContinuumExecution.mockClear();
    aiEngineMocks.applyContinuumExecutionFinalResult.mockClear();
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

    expect(aiEngineMocks.runContinuumExecution).toHaveBeenCalledTimes(1);
    expect(aiEngineMocks.runContinuumExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: expect.objectContaining({
          label: 'OpenAI',
        }),
        context: {
          currentView: undefined,
          currentData: {},
          detachedFields: [],
          issues: [],
        },
        instruction: 'Add a co-applicant section',
        mode: 'evolve-view',
      })
    );
    expect(
      aiEngineMocks.applyContinuumExecutionFinalResult
    ).toHaveBeenCalledWith(
      aiEngineMocks.sessionAdapter,
      expect.objectContaining({
        status: 'Applied update',
      })
    );
    expect(controller?.status).toBe('Applied update');
  });
});
