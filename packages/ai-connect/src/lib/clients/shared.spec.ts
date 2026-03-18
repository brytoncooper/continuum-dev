import { fetchJson, isSchemaFormatError, parseJsonText } from './shared.js';

describe('parseJsonText', () => {
  it('parses valid JSON values', () => {
    expect(parseJsonText<{ ok: boolean }>('{"ok":true}')).toEqual({
      ok: true,
    });
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonText('not json')).toBeNull();
  });
});

describe('fetchJson', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON for successful responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await expect(
      fetchJson('https://example.test/success', { method: 'POST' })
    ).resolves.toEqual({ ok: true });
  });

  it('includes status and response text in provider errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: async () => 'response_schema failed validation',
    });

    await expect(
      fetchJson('https://example.test/failure', { method: 'POST' })
    ).rejects.toThrow(
      'AI provider request failed (422 Unprocessable Entity): response_schema failed validation'
    );
  });
});

describe('isSchemaFormatError', () => {
  it.each([
    'response_format is invalid',
    'json_schema failed validation',
    'output_config was rejected',
    'output format mismatch',
    'output_format is unsupported',
    'response schema failed validation',
    'responseschema is invalid',
    'response_schema is invalid',
  ])('recognizes schema-format failures from "%s"', (message) => {
    expect(isSchemaFormatError(new Error(message))).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isSchemaFormatError(new Error('socket hang up'))).toBe(false);
  });
});
