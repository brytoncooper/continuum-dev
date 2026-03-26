import { describe, expect, it } from 'vitest';
import {
  advanceContinuumViewVersion,
  type ContinuumViewRevisionMode,
} from './view-evolution.js';

describe('advanceContinuumViewVersion', () => {
  it.each<
    [string | null | undefined, ContinuumViewRevisionMode, string]
  >([
    ['2', 'major', '3'],
    ['2', 'minor', '2.1'],
    ['2.1', 'major', '3'],
    ['2.1', 'minor', '2.2'],
    ['v2', 'major', 'v3'],
    ['v2', 'minor', 'v2.1'],
    ['baseline', 'major', 'baseline-next'],
    ['baseline', 'minor', 'baseline.1'],
    [undefined, 'major', '1'],
  ])(
    'advances %s in %s mode to %s',
    (input, mode, expected) => {
      expect(advanceContinuumViewVersion(input, mode)).toBe(expected);
    }
  );
});
