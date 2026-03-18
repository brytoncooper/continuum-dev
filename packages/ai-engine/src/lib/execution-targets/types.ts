export interface ContinuumExecutionTarget {
  nodeId: string;
  key?: string;
  semanticKey?: string;
  nodeType: string;
  label?: string;
  dataType?: string;
  options?: Array<{ value?: string; label?: string }>;
  templateFields?: ContinuumExecutionTarget[];
}

export type ContinuumScalarValue = string | number | boolean;

export type ContinuumCollectionItem = {
  values: Record<string, { value: ContinuumScalarValue }>;
};

export type ContinuumStateUpdate = {
  nodeId: string;
  value:
    | { value: ContinuumScalarValue }
    | { value: { items: ContinuumCollectionItem[] } };
};
