import { describe, expect, it } from 'vitest';

describe('published runtime surface', () => {
  it('root entry exports only the curated contract values and protocol constants', async () => {
    const root = await import('../index.js');
    expect(Object.keys(root).sort()).toEqual(
      [
        'DATA_RESOLUTIONS',
        'ISSUE_CODES',
        'ISSUE_SEVERITY',
        'VIEW_DIFFS',
        'applyContinuumNodeValueWrite',
        'applyContinuumViewUpdate',
        'decideContinuumNodeValueWrite',
        'reconcile',
      ].sort()
    );
  });

  it('exposes explicit subpaths for non-contract helpers', async () => {
    const nodeLookup = await import('../node-lookup.js');
    expect(typeof nodeLookup.resolveNodeLookupEntry).toBe('function');

    const canonical = await import('../canonical-snapshot.js');
    expect(typeof canonical.sanitizeContinuumDataSnapshot).toBe('function');

    const stream = await import('../view-stream.js');
    expect(typeof stream.applyContinuumViewStreamPart).toBe('function');

    const valueWrite = await import('../value-write.js');
    expect(typeof valueWrite.applyContinuumNodeValueWrite).toBe('function');

    const restore = await import('../restore-candidates.js');
    expect(typeof restore.findRestoreCandidates).toBe('function');

    const validator = await import('../validator.js');
    expect(typeof validator.validateNodeValue).toBe('function');

    const viewEvolution = await import('../view-evolution.js');
    expect(typeof viewEvolution.buildViewEvolutionDiagnostics).toBe('function');
    expect(typeof viewEvolution.shouldRejectAiEditDiagnostics).toBe('function');
  });

  it('does not publish view-patch through package entrypoints', async () => {
    const viewPatch = await import('./view-patch/index.js');
    expect(typeof viewPatch.applyContinuumViewPatch).toBe('function');
    const root = await import('../index.js');
    expect('applyContinuumViewPatch' in root).toBe(false);
    const stream = await import('../view-stream.js');
    expect('applyContinuumViewPatch' in stream).toBe(false);
    expect('patchViewDefinition' in stream).toBe(false);
  });
});
