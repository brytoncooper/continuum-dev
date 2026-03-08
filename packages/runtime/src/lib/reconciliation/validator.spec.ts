import { describe, it, expect } from 'vitest';
import type { ViewNode, NodeValue } from '@continuum-dev/contract';
import { ISSUE_CODES, ISSUE_SEVERITY } from '@continuum-dev/contract';
import { validateNodeValue } from './validator.js';

function makeField(overrides: Partial<ViewNode>): ViewNode {
  return {
    id: 'f1',
    type: 'field',
    dataType: 'string',
    ...overrides,
  } as ViewNode;
}

function val(value: any): NodeValue {
  return { value };
}

describe('validateNodeValue', () => {
  it('returns no issues when there are no constraints', () => {
    const node = makeField({});
    const issues = validateNodeValue(node, val('hello'));
    expect(issues).toHaveLength(0);
  });

  describe('required values', () => {
    const node = makeField({ constraints: { required: true } });

    it('reports an issue if the value is undefined', () => {
      const issues = validateNodeValue(node, undefined);
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(ISSUE_CODES.VALIDATION_FAILED);
    });

    it('reports an issue if the value is null', () => {
      const issues = validateNodeValue(node, val(null));
      expect(issues).toHaveLength(1);
    });

    it('reports an issue if a string is empty or whitespace', () => {
      expect(validateNodeValue(node, val(''))).toHaveLength(1);
      expect(validateNodeValue(node, val('   '))).toHaveLength(1);
    });

    it('reports an issue if an array is empty', () => {
      expect(validateNodeValue(node, val([]))).toHaveLength(1);
    });

    it('passes for valid non-empty values', () => {
      expect(validateNodeValue(node, val('text'))).toHaveLength(0);
      expect(validateNodeValue(node, val(0))).toHaveLength(0);
      expect(validateNodeValue(node, val(false))).toHaveLength(0);
      expect(validateNodeValue(node, val([1]))).toHaveLength(0);
    });
  });

  describe('numeric boundaries', () => {
    const node = makeField({ constraints: { min: 10, max: 20 } });

    it('reports an issue if below min', () => {
      const issues = validateNodeValue(node, val(9));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('below minimum 10');
    });

    it('reports an issue if above max', () => {
      const issues = validateNodeValue(node, val(21));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('above maximum 20');
    });

    it('passes if within bounds (inclusive)', () => {
      expect(validateNodeValue(node, val(10))).toHaveLength(0);
      expect(validateNodeValue(node, val(15))).toHaveLength(0);
      expect(validateNodeValue(node, val(20))).toHaveLength(0);
    });
  });

  describe('string length boundaries', () => {
    const node = makeField({ constraints: { minLength: 3, maxLength: 5 } });

    it('reports an issue if too short', () => {
      const issues = validateNodeValue(node, val('hi'));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('shorter than minLength 3');
    });

    it('reports an issue if too long', () => {
      const issues = validateNodeValue(node, val('toolong'));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('longer than maxLength 5');
    });

    it('passes if within bounds (inclusive)', () => {
      expect(validateNodeValue(node, val('123'))).toHaveLength(0);
      expect(validateNodeValue(node, val('1234'))).toHaveLength(0);
      expect(validateNodeValue(node, val('12345'))).toHaveLength(0);
    });
  });

  describe('string patterns', () => {
    const node = makeField({ constraints: { pattern: '^[A-Z]{3}$' } });

    it('reports an issue if pattern does not match', () => {
      const issues = validateNodeValue(node, val('abc'));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('does not match pattern');
    });

    it('passes if pattern matches', () => {
      expect(validateNodeValue(node, val('ABC'))).toHaveLength(0);
    });

    it('reports an issue for invalid regex patterns rather than throwing', () => {
      const badNode = makeField({ constraints: { pattern: '[' } });
      const issues = validateNodeValue(badNode, val('test'));
      expect(issues).toHaveLength(1);
      expect(issues[0].message).toContain('invalid validation pattern');
    });
  });

  it('ignores constraint types that do not match the value type', () => {
    // pattern on a number
    const node = makeField({ constraints: { pattern: '^[A-Z]+$' } });
    expect(validateNodeValue(node, val(123))).toHaveLength(0);

    // min/max on a string
    const node2 = makeField({ constraints: { min: 5 } });
    expect(validateNodeValue(node2, val('1'))).toHaveLength(0); // '1' is length 1, but value is string "1", so min check is skipped
  });
});
