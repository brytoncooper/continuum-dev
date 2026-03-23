import { buildRuntimeErrors } from './runtime-errors.js';

describe('buildRuntimeErrors', () => {
  it('prefers message strings and safely serializes opaque issues', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(
      buildRuntimeErrors([
        new Error('Broken'),
        { code: 'E_FAIL' },
        circular,
        42,
      ])
    ).toEqual(['Broken', '{"code":"E_FAIL"}', '[object Object]', '42']);
  });
});
