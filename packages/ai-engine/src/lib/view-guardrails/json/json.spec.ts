import { parseJson } from './json.js';

describe('parseJson', () => {
  it('extracts a fenced payload from noisy model output', () => {
    expect(
      parseJson<{
        viewId: string;
        version: string;
        nodes: unknown[];
      }>(`Here is the repaired view.

\`\`\`json
{"viewId":"profile","version":"2","nodes":[]}
\`\`\`

I kept the structure minimal.`)
    ).toEqual({
      viewId: 'profile',
      version: '2',
      nodes: [],
    });
  });

  it('skips bracketed prose before the first valid json payload', () => {
    expect(
      parseJson<{ ok: boolean; count: number }>(
        'Status [draft only]\n{"ok":true,"count":2}'
      )
    ).toEqual({
      ok: true,
      count: 2,
    });
  });

  it('handles braces and escaped quotes inside json strings', () => {
    expect(
      parseJson<{
        message: string;
        items: Array<{ ok: boolean }>;
      }>(
        'Use this payload: {"message":"brace } and quote \\" text","items":[{"ok":true}]}'
      )
    ).toEqual({
      message: 'brace } and quote " text',
      items: [{ ok: true }],
    });
  });

  it('returns null when no valid json can be found', () => {
    expect(parseJson('This response never returns a payload.')).toBeNull();
  });
});
