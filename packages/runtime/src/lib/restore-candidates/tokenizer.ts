export const TOKEN_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'contact',
  'data',
  'details',
  'field',
  'form',
  'group',
  'info',
  'information',
  'item',
  'person',
  'profile',
  'request',
  'section',
  'tax',
  'the',
]);

export function tokenize(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_./:-]+/g, ' ')
    .toLowerCase();

  return new Set(
    normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !TOKEN_STOP_WORDS.has(token))
  );
}

export function mergeTokenSets(...sets: Array<Set<string>>): Set<string> {
  const merged = new Set<string>();
  for (const set of sets) {
    for (const value of set) {
      merged.add(value);
    }
  }
  return merged;
}

export function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) {
      count += 1;
    }
  }
  return count;
}
