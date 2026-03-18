import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  useVercelAiSdkChatController,
  type VercelAiSdkChatControllerState,
} from './use-vercel-ai-sdk-chat-controller.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vercelAiSdkMocks = vi.hoisted(() => {
  const sessionAdapter = {
    sessionId: 'session-1',
  };

  const chatState = {
    status: 'ready' as 'submitted' | 'streaming' | 'ready' | 'error',
    latestStatus: null as { status: string; level: string } | null,
    error: null as Error | null,
  };

  return {
    sessionAdapter,
    chatState,
    sendMessage: vi.fn(async () => undefined),
    clearError: vi.fn(),
    createContinuumSessionAdapter: vi.fn(() => sessionAdapter),
  };
});

vi.mock('@continuum-dev/vercel-ai-sdk-adapter', () => ({
  useContinuumVercelAiSdkChat: () => ({
    messages: [],
    status: vercelAiSdkMocks.chatState.status,
    latestStatus: vercelAiSdkMocks.chatState.latestStatus,
    error: vercelAiSdkMocks.chatState.error,
    sendMessage: vercelAiSdkMocks.sendMessage,
    clearError: vercelAiSdkMocks.clearError,
  }),
}));

vi.mock('@continuum-dev/ai-engine', () => ({
  createContinuumSessionAdapter:
    vercelAiSdkMocks.createContinuumSessionAdapter,
}));

vi.mock('@continuum-dev/react', () => ({
  useContinuumSession: () => ({
    sessionId: 'session-1',
  }),
  useContinuumStreaming: () => ({
    streams: [],
    activeStream: null,
    isStreaming: false,
  }),
}));

describe(
  '@continuum-dev/starter-kit-ai/useVercelAiSdkChatController',
  () => {
    let container: HTMLDivElement;
    let root: Root;
    let controller: VercelAiSdkChatControllerState | null = null;

    function Harness(props: {
      onSubmittingChange?: (isSubmitting: boolean) => void;
      onError?: (error: Error) => void;
    }) {
      controller = useVercelAiSdkChatController(props);
      return null;
    }

    beforeEach(() => {
      controller = null;
      vercelAiSdkMocks.chatState.status = 'ready';
      vercelAiSdkMocks.chatState.latestStatus = null;
      vercelAiSdkMocks.chatState.error = null;
      vercelAiSdkMocks.sendMessage.mockClear();
      vercelAiSdkMocks.clearError.mockClear();
      container = document.createElement('div');
      root = createRoot(container);
    });

    afterEach(async () => {
      await act(async () => {
        root.unmount();
      });
    });

    it('does not re-notify submitting callbacks when only the callback identity changes', async () => {
      const firstCallback = vi.fn();

      await act(async () => {
        root.render(<Harness onSubmittingChange={firstCallback} />);
      });

      expect(controller).not.toBeNull();
      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(firstCallback).toHaveBeenLastCalledWith(false);

      const secondCallback = vi.fn();
      await act(async () => {
        root.render(<Harness onSubmittingChange={secondCallback} />);
      });

      expect(secondCallback).not.toHaveBeenCalled();
    });

    it('does not re-notify error callbacks when only the callback identity changes', async () => {
      const error = new Error('stream failed');
      vercelAiSdkMocks.chatState.error = error;
      const firstCallback = vi.fn();

      await act(async () => {
        root.render(<Harness onError={firstCallback} />);
      });

      expect(firstCallback).toHaveBeenCalledTimes(1);
      expect(firstCallback).toHaveBeenLastCalledWith(error);

      const secondCallback = vi.fn();
      await act(async () => {
        root.render(<Harness onError={secondCallback} />);
      });

      expect(secondCallback).not.toHaveBeenCalled();
    });
  }
);
