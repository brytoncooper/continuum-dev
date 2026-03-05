export interface PatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

export interface ViewPatch {
  mode: 'patch';
  viewId: string;
  version: string;
  operations: PatchOperation[];
}
