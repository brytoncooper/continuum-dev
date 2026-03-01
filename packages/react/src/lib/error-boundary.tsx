import { Component, type ReactNode } from 'react';

interface NodeErrorBoundaryProps {
  nodeId: string;
  children: ReactNode;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class NodeErrorBoundary extends Component<
  NodeErrorBoundaryProps,
  NodeErrorBoundaryState
> {
  override state: NodeErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): NodeErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div data-continuum-render-error={this.props.nodeId}>
          Node render failed: {this.props.nodeId} ({this.state.message})
        </div>
      );
    }
    return this.props.children;
  }
}
