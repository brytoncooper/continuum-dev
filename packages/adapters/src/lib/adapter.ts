import type { ViewDefinition, NodeValue } from '@continuum/contract';

export interface ProtocolAdapter<TExternalView, TExternalData = unknown> {
  name: string;
  toView(external: TExternalView): ViewDefinition;
  fromView?(definition: ViewDefinition): TExternalView;
  toState?(externalData: TExternalData): Record<string, NodeValue>;
  fromState?(state: Record<string, NodeValue>): TExternalData;
}
