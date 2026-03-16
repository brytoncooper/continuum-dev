import type { DetachedValue } from '@continuum-dev/contract';
import type { RestoreNodeCandidate } from './types.js';
import { mergeTokenSets, overlapCount, tokenize } from './tokenizer.js';

export function buildSourceTokens(detachedValue: DetachedValue) {
  const labelTokens = tokenize(detachedValue.previousLabel);
  const parentTokens = tokenize(detachedValue.previousParentLabel);
  const keyTokens = tokenize(detachedValue.key);
  const semanticTokens = tokenize(detachedValue.semanticKey);

  return {
    label: labelTokens,
    parent: parentTokens,
    key: keyTokens,
    semanticKey: semanticTokens,
    all: mergeTokenSets(labelTokens, parentTokens, keyTokens, semanticTokens),
  };
}

export function scoreCandidate(
  detachedValue: DetachedValue,
  candidate: RestoreNodeCandidate
): number {
  const source = buildSourceTokens(detachedValue);

  let score = 0;
  score += overlapCount(source.label, candidate.tokens.label) * 12;
  score += overlapCount(source.label, candidate.tokens.semanticKey) * 8;
  score += overlapCount(source.label, candidate.tokens.key) * 6;
  score += overlapCount(source.parent, candidate.tokens.parent) * 6;
  score += overlapCount(source.parent, candidate.tokens.path) * 4;
  score += overlapCount(source.semanticKey, candidate.tokens.semanticKey) * 12;
  score += overlapCount(source.semanticKey, candidate.tokens.key) * 8;
  score += overlapCount(source.semanticKey, candidate.tokens.label) * 6;
  score += overlapCount(source.key, candidate.tokens.key) * 10;
  score += overlapCount(source.key, candidate.tokens.label) * 6;
  score += overlapCount(source.all, candidate.tokens.all) * 2;

  if (
    detachedValue.semanticKey &&
    candidate.node.semanticKey &&
    detachedValue.semanticKey === candidate.node.semanticKey
  ) {
    score += 24;
  }

  if (
    detachedValue.key &&
    candidate.node.key &&
    detachedValue.key === candidate.node.key
  ) {
    score += 16;
  }

  if (
    detachedValue.previousLabel &&
    candidate.label &&
    detachedValue.previousLabel.trim().toLowerCase() ===
      candidate.label.trim().toLowerCase()
  ) {
    score += 18;
  }

  return score;
}
