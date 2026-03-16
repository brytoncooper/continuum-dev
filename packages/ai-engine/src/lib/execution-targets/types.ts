export interface StarterKitExecutionTarget {
  nodeId: string;
  key?: string;
  semanticKey?: string;
  nodeType: string;
  label?: string;
  dataType?: string;
  options?: Array<{ value?: string; label?: string }>;
  templateFields?: StarterKitExecutionTarget[];
}

export type StarterKitScalarValue = string | number | boolean;

export type StarterKitCollectionItem = {
  values: Record<string, { value: StarterKitScalarValue }>;
};

export type StarterKitStateUpdate = {
  nodeId: string;
  value:
    | { value: StarterKitScalarValue }
    | { value: { items: StarterKitCollectionItem[] } };
};
