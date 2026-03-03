export interface ViewDefinition {
  viewId: string;
  version: string;
  nodes: ViewNode[];
}

export type ViewNode =
  | FieldNode
  | GroupNode
  | CollectionNode
  | ActionNode
  | PresentationNode
  | RowNode
  | GridNode;

export interface BaseNode {
  id: string;
  type: string;
  key?: string;
  hidden?: boolean;
  hash?: string;
  migrations?: MigrationRule[];
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldNode extends BaseNode {
  type: 'field';
  dataType: 'string' | 'number' | 'boolean';
  label?: string;
  placeholder?: string;
  description?: string;
  readOnly?: boolean;
  defaultValue?: unknown;
  constraints?: FieldConstraints;
  options?: FieldOption[];
}

export interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  children: ViewNode[];
}

export interface CollectionNode extends BaseNode {
  type: 'collection';
  label?: string;
  template: ViewNode;
  minItems?: number;
  maxItems?: number;
}

export interface ActionNode extends BaseNode {
  type: 'action';
  intentId: string;
  label: string;
  disabled?: boolean;
}

export interface PresentationNode extends BaseNode {
  type: 'presentation';
  contentType: 'text' | 'markdown';
  content: string;
}

export interface RowNode extends BaseNode {
  type: 'row';
  children: ViewNode[];
}

export interface GridNode extends BaseNode {
  type: 'grid';
  columns?: number;
  children: ViewNode[];
}

export interface FieldConstraints {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface MigrationRule {
  fromHash: string;
  toHash: string;
  strategyId?: string;
}

export function getChildNodes(node: ViewNode): ViewNode[] {
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    return (node as any).children;
  }
  if (node.type === 'collection') {
    return [node.template];
  }
  return [];
}
