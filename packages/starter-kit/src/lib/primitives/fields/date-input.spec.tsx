// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeValue, ViewNode } from '@continuum-dev/contract';
import { DateInput } from './date-input.js';

const definition = {
  id: 'appointment_date',
  type: 'date',
  label: 'Appointment date',
  description: 'Pick the final date for the visit.',
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

function renderDateInput(value: NodeValue<string> | undefined, onChange = vi.fn()) {
  const rendered = render(
    <DateInput
      value={value}
      onChange={onChange}
      definition={definition}
      nodeId="appointment_date"
    />
  );

  return { onChange, ...rendered };
}

describe('DateInput', () => {
  beforeEach(() => {
    installMatchMedia(false);
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('opens a custom calendar and keeps the shared control height', () => {
    const { onChange } = renderDateInput({ value: '2026-04-18' });

    const trigger = screen.getByRole('button', { name: /appointment date/i });
    expect(trigger.style.height).toBe('44px');

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /april 21, 2026/i }));

    expect(onChange).toHaveBeenCalledWith({
      value: '2026-04-21',
      isDirty: true,
    });
  });

  it('supports flexible typed date entry and month/year navigation', () => {
    const { onChange } = renderDateInput({ value: '2026-04-18' });

    fireEvent.click(screen.getByRole('button', { name: /appointment date/i }));

    fireEvent.click(screen.getByRole('button', { name: 'April 2026' }));
    expect(screen.getByRole('button', { name: 'Jan' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(screen.getByRole('button', { name: '2030' })).toBeTruthy();

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'May 21, 2030' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onChange).toHaveBeenCalledWith({
      value: '2030-05-21',
      isDirty: true,
    });
  });

  it('positions the desktop calendar upward near the bottom of the viewport', () => {
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

    renderDateInput({ value: '2026-04-18' });
    const trigger = screen.getByRole('button', { name: /appointment date/i });

    Object.defineProperty(trigger, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 120,
        y: 430,
        top: 430,
        bottom: 474,
        left: 120,
        right: 360,
        width: 240,
        height: 44,
        toJSON: () => '',
      }),
    });

    fireEvent.click(trigger);

    const popup = document.body.querySelector(
      '[data-continuum-date-popup="true"]'
    ) as HTMLDivElement | null;

    expect(popup?.dataset.continuumDatePlacement).toBe('up');
    expect(popup?.style.position).toBe('fixed');
    expect(popup?.style.bottom).toBe('98px');
    expect(popup?.style.height).toBe('410px');
    expect(popup?.style.overflowY).toBe('auto');
  });

  it('uses the mobile sheet behavior on compact viewports', () => {
    installMatchMedia(true);
    renderDateInput({ value: '2026-04-18' });

    fireEvent.click(screen.getByRole('button', { name: /appointment date/i }));

    const popup = document.body.querySelector(
      '[data-continuum-date-popup="true"]'
    ) as HTMLDivElement | null;

    expect(popup?.dataset.continuumDatePlacement).toBe('sheet');
    expect(document.body.style.overflow).toBe('hidden');
  });
});
