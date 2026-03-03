export interface PatchOperation {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: any;
}

export interface ViewPatch {
  mode: 'patch';
  viewId: string;
  version: string;
  operations: PatchOperation[];
}
