export function toCanonicalId(id: string, parentPath: string): string {
  return parentPath.length > 0 ? `${parentPath}/${id}` : id;
}

export function isNodeWithinScope(nodeId: string, scopeId: string): boolean {
  return (
    nodeId === scopeId ||
    nodeId.startsWith(`${scopeId}/`) ||
    scopeId.startsWith(`${nodeId}/`)
  );
}

export function toRelativeNodeId(
  collectionCanonicalId: string,
  nodeId: string
): string | null {
  if (nodeId === collectionCanonicalId) {
    return null;
  }
  if (nodeId.startsWith(`${collectionCanonicalId}/`)) {
    return nodeId.slice(collectionCanonicalId.length + 1);
  }
  return null;
}
