import { buildDetachedFieldHints } from './detached-fields.js';

const LONG_TEXT = 'L'.repeat(220);

describe('buildDetachedFieldHints', () => {
  it('extracts runtime continuity hints and truncates long previews and labels', () => {
    const hints = buildDetachedFieldHints({
      'detached:email': {
        previousNodeType: 'field',
        reason: 'node-removed',
        viewVersion: '3',
        key: 'person.email',
        previousLabel: LONG_TEXT,
        previousParentLabel: LONG_TEXT,
        value: {
          value: {
            summary: LONG_TEXT,
          },
        },
      },
      'detached:count': {
        viewVersion: '4',
        value: 42,
      },
    });

    expect(hints).toEqual([
      {
        detachedKey: 'detached:email',
        previousNodeType: 'field',
        reason: 'node-removed',
        viewVersion: '3',
        key: 'person.email',
        previousLabel: `${LONG_TEXT.slice(0, 180)}...`,
        previousParentLabel: `${LONG_TEXT.slice(0, 180)}...`,
        valuePreview: {
          summary: `${LONG_TEXT.slice(0, 180)}...`,
        },
      },
      {
        detachedKey: 'detached:count',
        previousNodeType: 'unknown',
        reason: 'node-removed',
        viewVersion: '4',
        valuePreview: 42,
      },
    ]);
  });

  it('ignores malformed entries and caps output to 64 hints', () => {
    const validEntries = Object.fromEntries(
      Array.from({ length: 70 }, (_, index) => [
        `detached_${index}`,
        {
          previousNodeType: 'field',
          viewVersion: '1',
          value: index,
        },
      ])
    );

    const hints = buildDetachedFieldHints({
      malformed: 'skip me',
      alsoMalformed: null,
      ...validEntries,
    });

    expect(hints).toHaveLength(64);
    expect(hints[0]?.detachedKey).toBe('detached_0');
    expect(hints[63]?.detachedKey).toBe('detached_63');
    expect(
      hints.find((hint) => hint.detachedKey === 'malformed')
    ).toBeUndefined();
  });
});
