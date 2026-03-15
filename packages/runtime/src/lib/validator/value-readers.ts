import type { IsEmptyValueInput, ReadStateValueInput } from './types.js';

export function readStateValue({ state }: ReadStateValueInput): unknown {
  if (!state) {
    return undefined;
  }
  return state.value;
}

export function isEmptyValue({ value }: IsEmptyValueInput): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
