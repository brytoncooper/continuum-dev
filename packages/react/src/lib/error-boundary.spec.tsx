import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { NodeErrorBoundary } from './error-boundary.js';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let bombShouldThrow = false;
let bombError: unknown = new Error('');

function Bomb() {
  if (bombShouldThrow) throw bombError;
  return <div data-testid="child">child content</div>;
}

describe('NodeErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    bombShouldThrow = false;
    bombError = new Error('');
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    const { getByTestId } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(getByTestId('child').textContent).toBe('child content');
  });

  it('catches Error instance and displays message', () => {
    bombShouldThrow = true;
    bombError = new Error('test error');
    const { container } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('test error');
  });

  it('catches non-Error thrown value and displays String representation', () => {
    bombShouldThrow = true;
    bombError = 'string error';
    const { container } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('string error');
  });

  it('displays nodeId in error UI', () => {
    bombShouldThrow = true;
    bombError = new Error('fail');
    const { container } = render(
      <NodeErrorBoundary nodeId="my-node-42">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('my-node-42');
  });

  it('sets data-continuum-render-error attribute with nodeId', () => {
    bombShouldThrow = true;
    bombError = new Error('fail');
    const { container } = render(
      <NodeErrorBoundary nodeId="err-node">
        <Bomb />
      </NodeErrorBoundary>
    );
    const errorDiv = container.querySelector(
      '[data-continuum-render-error="err-node"]'
    );
    expect(errorDiv).not.toBeNull();
  });

  it('resets error state when children prop changes', () => {
    bombShouldThrow = true;
    bombError = new Error('boom');
    const { container, rerender } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('boom');

    bombShouldThrow = false;
    rerender(
      <NodeErrorBoundary nodeId="n1">
        <div data-testid="new-child">recovered</div>
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('recovered');
    expect(container.textContent).not.toContain('boom');
  });

  it('does not reset error state when children prop is same reference', () => {
    bombShouldThrow = true;
    bombError = new Error('stuck');
    const bombElement = <Bomb />;
    const { container, rerender } = render(
      <NodeErrorBoundary nodeId="n1">{bombElement}</NodeErrorBoundary>
    );
    expect(container.textContent).toContain('stuck');

    bombShouldThrow = false;
    rerender(<NodeErrorBoundary nodeId="n1">{bombElement}</NodeErrorBoundary>);
    expect(container.textContent).toContain('stuck');
  });

  it('recovers and renders new children after reset', () => {
    bombShouldThrow = true;
    bombError = new Error('initial fail');
    const { container, rerender } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('initial fail');

    bombShouldThrow = false;
    rerender(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('child content');
  });

  it('handles multiple sequential errors', () => {
    bombShouldThrow = true;
    bombError = new Error('first');
    const { container, rerender } = render(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('first');

    bombError = new Error('second');
    rerender(
      <NodeErrorBoundary nodeId="n1">
        <Bomb />
      </NodeErrorBoundary>
    );
    expect(container.textContent).toContain('second');
  });

  it('isolates error from sibling boundaries in same tree', () => {
    bombShouldThrow = true;
    bombError = new Error('isolated');
    const { container, getByTestId } = render(
      <div>
        <NodeErrorBoundary nodeId="bad">
          <Bomb />
        </NodeErrorBoundary>
        <NodeErrorBoundary nodeId="good">
          <div data-testid="good-child">all good</div>
        </NodeErrorBoundary>
      </div>
    );
    expect(container.textContent).toContain('isolated');
    expect(getByTestId('good-child').textContent).toBe('all good');
  });
});
