export function parentOf(path: string): string {
  const separator = path.lastIndexOf('/');
  if (separator === -1) {
    return '';
  }
  return path.slice(0, separator);
}

export function toIndexedKey(key: string, parentPath: string): string {
  if (parentPath.length === 0) {
    return key;
  }
  return `${parentPath}/${key}`;
}

export function toScopedKey(key: string, scopedNodeId: string): string {
  return toIndexedKey(key, parentOf(scopedNodeId));
}

export function isUnique(counts: Map<string, number>, key: string): boolean {
  return (counts.get(key) ?? 0) === 1;
}
