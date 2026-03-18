import { describe, expect, it } from 'vitest';
import { coerceScalarStateValue } from './coercion.js';

describe('execution target value coercion', () => {
  it('coerces booleans for toggles and boolean fields', () => {
    expect(
      coerceScalarStateValue(
        {
          nodeId: 'opt_in',
          nodeType: 'toggle',
        },
        'yes'
      )
    ).toBe(true);

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'consent',
          nodeType: 'field',
          dataType: 'boolean',
        },
        { value: 'off' }
      )
    ).toBe(false);
  });

  it('coerces numbers for sliders and numeric fields', () => {
    expect(
      coerceScalarStateValue(
        {
          nodeId: 'score',
          nodeType: 'slider',
        },
        ' 1,234.5 '
      )
    ).toBe(1234.5);

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'amount',
          nodeType: 'field',
          dataType: 'number',
        },
        '$2,050'
      )
    ).toBe(2050);
  });

  it('maps select and radio-group values by option value or label', () => {
    const target = {
      nodeId: 'status',
      nodeType: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    };

    expect(coerceScalarStateValue(target, 'active')).toBe('active');
    expect(coerceScalarStateValue(target, 'Inactive')).toBe('inactive');

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'relationship',
          nodeType: 'radio-group',
          options: [
            { value: 'child', label: 'Child' },
            { value: 'spouse', label: 'Spouse' },
          ],
        },
        'Spouse'
      )
    ).toBe('spouse');
  });

  it('returns strings for other scalar fields', () => {
    expect(
      coerceScalarStateValue(
        {
          nodeId: 'name',
          nodeType: 'field',
          dataType: 'string',
        },
        { value: 'Jordan Lee' }
      )
    ).toBe('Jordan Lee');

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'notes',
          nodeType: 'textarea',
        },
        42
      )
    ).toBe('42');
  });

  it('returns undefined for nullish or uncoercible values', () => {
    expect(
      coerceScalarStateValue(
        {
          nodeId: 'name',
          nodeType: 'field',
          dataType: 'string',
        },
        null
      )
    ).toBeUndefined();

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'score',
          nodeType: 'slider',
        },
        'not a number'
      )
    ).toBeUndefined();

    expect(
      coerceScalarStateValue(
        {
          nodeId: 'status',
          nodeType: 'select',
          options: [{ value: 'active', label: 'Active' }],
        },
        'unknown'
      )
    ).toBeUndefined();
  });
});
