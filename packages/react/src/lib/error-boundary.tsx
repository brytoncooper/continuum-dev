import { Component, type ReactNode } from 'react';

interface ComponentErrorBoundaryProps {
  componentId: string;
  children: ReactNode;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  override state: ComponentErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): ComponentErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div data-continuum-render-error={this.props.componentId}>
          Component render failed: {this.props.componentId} ({this.state.message})
        </div>
      );
    }
    return this.props.children;
  }
}
