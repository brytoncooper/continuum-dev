import { describe, expect, it, vi } from 'vitest';
import { FallbackComponent } from './fallback.js';

describe('FallbackComponent', () => {
  it('returns a renderable React element for unknown node types', () => {
    const onChange = vi.fn();

    const element = FallbackComponent({
      value: { value: 'hello' },
      onChange,
      definition: {
        id: 'field-1',
        type: 'field',
        dataType: 'string',
        label: 'Field One',
        placeholder: 'Type here',
      },
    });

    expect(element).toBeDefined();
    expect(element.type).toBe('div');
    expect(element.props.children).toBeDefined();
    expect(element.props.children[1].props.placeholder).toBe('Type here');
  });
});
