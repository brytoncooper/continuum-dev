// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { SelectInput } from './select-input.js';

const definition = {
  id: 'travel_style',
  type: 'select',
  label: 'Travel style',
  description: 'Choose the pace that best fits this itinerary.',
  options: [
    { value: 'quiet', label: 'Quiet' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'active', label: 'Active' },
  ],
} as unknown as ViewNode;

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderSelect(
  value: NodeValue<string> | undefined,
  onChange = vi.fn()
) {
  const rendered = render(
    <SelectInput
      value={value}
      onChange={onChange}
      definition={definition}
      nodeId="travel_style"
    />
  );

  return { onChange, ...rendered };
}

describe('SelectInput', () => {
  beforeEach(() => {
    installMatchMedia(false);
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('opens a premium listbox and commits the clicked option', () => {
    const { onChange } = renderSelect({ value: 'balanced' });

    const trigger = screen.getByRole('button', { name: /travel style/i });
    expect(trigger.style.height).toBe('44px');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Active' }));

    expect(onChange).toHaveBeenCalledWith({
      value: 'active',
      isDirty: true,
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('positions the desktop popup upward near the bottom of the viewport', () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 520,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });

    renderSelect({ value: 'balanced' });
    const trigger = screen.getByRole('button', { name: /travel style/i });

    Object.defineProperty(trigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 120,
        y: 430,
        top: 430,
        bottom: 474,
        left: 120,
        right: 420,
        width: 300,
        height: 44,
        toJSON: () => '',
      }),
    });

    fireEvent.click(trigger);

    const popup = document.body.querySelector(
      '[data-continuum-select-popup="true"]'
    ) as HTMLDivElement | null;

    expect(popup?.dataset.continuumSelectPlacement).toBe('up');
    expect(popup?.style.position).toBe('fixed');
    expect(popup?.style.bottom).toBe('98px');
  });

  it('supports keyboard selection from the trigger', async () => {
    const { onChange } = renderSelect({ value: 'balanced' });
    const trigger = screen.getByRole('button', { name: /travel style/i });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const activeOption = screen.getByRole('option', { name: 'Active' });
    await waitFor(() => expect(document.activeElement).toBe(activeOption));

    fireEvent.keyDown(activeOption, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({
      value: 'active',
      isDirty: true,
    });
  });

  it('uses the compact picker sheet when the viewport is narrow', () => {
    installMatchMedia(true);
    renderSelect({ value: 'quiet' });

    fireEvent.click(screen.getByRole('button', { name: /travel style/i }));

    expect(
      screen.getByText('Tap an option to update this field.')
    ).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });
});
