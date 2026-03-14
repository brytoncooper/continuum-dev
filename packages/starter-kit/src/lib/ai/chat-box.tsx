import {
  StarterKitVercelAiSdkChatBox,
  type StarterKitVercelAiSdkChatBoxProps,
} from './vercel-ai-sdk-chat-box.js';
import {
  StarterKitProviderChatBox,
  type StarterKitProviderChatBoxProps,
} from './provider-chat-box.js';

export type StarterKitChatBoxDriver =
  | {
    kind: 'provider';
    props: StarterKitProviderChatBoxProps;
  }
  | {
      kind: 'vercel-ai-sdk';
      props: StarterKitVercelAiSdkChatBoxProps;
    };

export interface StarterKitChatBoxProps {
  driver: StarterKitChatBoxDriver;
}

export function StarterKitChatBox({ driver }: StarterKitChatBoxProps) {
  if (driver.kind === 'provider') {
    return <StarterKitProviderChatBox {...driver.props} />;
  }

  return <StarterKitVercelAiSdkChatBox {...driver.props} />;
}
