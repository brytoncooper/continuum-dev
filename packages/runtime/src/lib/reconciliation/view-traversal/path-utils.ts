export function toIndexedId(id: string, parentPath: string): string {
  if (parentPath.length > 0) {
    return `${parentPath}/${id}`;
  }
  return id;
}
