import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FallbackComponent } from './fallback.js';

describe('FallbackComponent', () => {
  it('renders the fallback contract for an unmapped node type', () => {
    const { container, getByText } = render(
      <FallbackComponent
        value={{ value: 'hello' }}
        onChange={vi.fn()}
        definition={{
          id: 'field-1',
          type: 'field',
          dataType: 'string',
          label: 'Field One',
          placeholder: 'Type here',
        }}
      />
    );

    expect(
      container.querySelector('[data-continuum-fallback="field"]')
    ).not.toBeNull();
    expect(getByText('Unknown type: field (Field One)')).toBeTruthy();
    expect(
      (container.querySelector('input') as HTMLInputElement).placeholder
    ).toBe('Type here');
  });

  it('renders string value in input', () => {
    const { container } = render(
      <FallbackComponent
        value={{ value: 'hello' }}
        onChange={vi.fn()}
        definition={{ id: 'f1', type: 'field', dataType: 'string' }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('hello');
  });

  it('renders number value as string in input', () => {
    const { container } = render(
      <FallbackComponent
        value={{ value: 42 }}
        onChange={vi.fn()}
        definition={{ id: 'f1', type: 'field', dataType: 'number' }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('42');
  });

  it('renders empty string when value is undefined', () => {
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={{ id: 'f1', type: 'field', dataType: 'string' }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('renders empty string when value.value is an object', () => {
    const { container } = render(
      <FallbackComponent
        value={{ value: { nested: true } }}
        onChange={vi.fn()}
        definition={{ id: 'f1', type: 'field', dataType: 'string' }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('uses definition.id when label is missing', () => {
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={{ id: 'my-field', type: 'field', dataType: 'string' }}
      />
    );
    const title = container.querySelector('.continuum-fallback-title');
    expect(title?.textContent).toContain('my-field');
  });

  it('uses label as displayName when label is a string', () => {
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={{
          id: 'f1',
          type: 'field',
          dataType: 'string',
          label: 'My Label',
        }}
      />
    );
    const title = container.querySelector('.continuum-fallback-title');
    expect(title?.textContent).toContain('My Label');
  });

  it('uses placeholder when it is a string', () => {
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={{
          id: 'f1',
          type: 'field',
          dataType: 'string',
          placeholder: 'Custom placeholder',
        }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Custom placeholder');
  });

  it('generates default placeholder from displayName', () => {
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={{
          id: 'f1',
          type: 'field',
          dataType: 'string',
          label: 'My Field',
        }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter value for "My Field"');
  });

  it('calls onChange with NodeValue on input change event simulation', () => {
    const onChange = vi.fn();
    const { container } = render(
      <FallbackComponent
        value={{ value: '' }}
        onChange={onChange}
        definition={{ id: 'f1', type: 'field', dataType: 'string' }}
      />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new text' } });
    expect(onChange).toHaveBeenCalledWith({ value: 'new text' });
  });

  it('renders JSON definition in details/pre element', () => {
    const definition = {
      id: 'f1',
      type: 'field' as const,
      dataType: 'string' as const,
    };
    const { container } = render(
      <FallbackComponent
        value={undefined}
        onChange={vi.fn()}
        definition={definition}
      />
    );
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toContain(JSON.stringify(definition, null, 2));
  });
});
