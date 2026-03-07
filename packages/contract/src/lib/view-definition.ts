/**
 * The root AST representing the AI-generated UI layout and structure.
 * The AI owns this structure, while the user owns the corresponding DataSnapshot.
 */
export interface ViewDefinition {
  /**
   * Stable logical identity of the view family.
   */
  viewId: string;
  /**
   * View revision identifier for ordering and compatibility checks.
   */
  version: string;
  /**
   * Top-level nodes in render order.
   */
  nodes: ViewNode[];
}

/**
 * Discriminated union of all supported view node types.
 */
export type ViewNode =
  | FieldNode
  | GroupNode
  | CollectionNode
  | ActionNode
  | PresentationNode
  | RowNode
  | GridNode;

/**
 * Base properties shared by all nodes in the ViewDefinition tree.
 */
export interface BaseNode {
  /**
   * Required per-version structural identifier.
   */
  id: string;
  /**
   * Node discriminant.
   */
  type: string;
  /**
   * Optional semantic identity for cross-version data matching.
   */
  key?: string;
  /**
   * Optional explicit semantic identity for cross-level matching.
   */
  semanticKey?: string;
  /**
   * Optional visibility hint.
   */
  hidden?: boolean;
  /**
   * Structural fingerprint used to detect node-configuration changes.
   */
  hash?: string;
  /**
   * Rules for safely migrating data when node hashes change.
   */
  migrations?: MigrationRule[];
}

/**
 * Select option for constrained field values.
 */
export interface FieldOption {
  /**
   * Canonical option value.
   */
  value: string;
  /**
   * User-facing option label.
   */
  label: string;
}

/**
 * Data-bearing input node.
 */
export interface FieldNode extends BaseNode {
  type: 'field';
  /**
   * Primitive value domain expected for this field.
   */
  dataType: 'string' | 'number' | 'boolean';
  /**
   * User-facing field label.
   */
  label?: string;
  /**
   * Placeholder hint for empty state.
   */
  placeholder?: string;
  /**
   * Optional helper text.
   */
  description?: string;
  /**
   * Disables user edits when true.
   */
  readOnly?: boolean;
  /**
   * Initial value before user interaction.
   */
  defaultValue?: unknown;
  /**
   * Optional validation constraints.
   */
  constraints?: FieldConstraints;
  /**
   * Optional list of allowed values.
   */
  options?: FieldOption[];
}

/**
 * Structural container that groups child nodes.
 */
export interface GroupNode extends BaseNode {
  type: 'group';
  /**
   * Optional group label.
   */
  label?: string;
  /**
   * Suggested layout strategy for rendering children.
   */
  layout?: 'vertical' | 'horizontal' | 'grid';
  /**
   * Optional column count when layout is grid-like.
   */
  columns?: number;
  /**
   * Child nodes in order.
   */
  children: ViewNode[];
}

/**
 * Repeatable node pattern with a single item template.
 */
export interface CollectionNode extends BaseNode {
  type: 'collection';
  /**
   * Optional collection label.
   */
  label?: string;
  /**
   * Template applied to each item.
   */
  template: ViewNode;
  /**
   * Minimum item count.
   */
  minItems?: number;
  /**
   * Maximum item count.
   */
  maxItems?: number;
  /**
   * Optional default payloads for initial items.
   */
  defaultValues?: Array<Record<string, unknown>>;
}

/**
 * Trigger node that emits intents.
 */
export interface ActionNode extends BaseNode {
  type: 'action';
  /**
   * Intent identifier emitted by this action.
   */
  intentId: string;
  /**
   * User-facing action text.
   */
  label: string;
  /**
   * Optional disabled state.
   */
  disabled?: boolean;
}

/**
 * Read-only content node.
 */
export interface PresentationNode extends BaseNode {
  type: 'presentation';
  /**
   * Rendering mode for content.
   */
  contentType: 'text' | 'markdown';
  /**
   * Raw content payload.
   */
  content: string;
}

/**
 * Horizontal structural container.
 */
export interface RowNode extends BaseNode {
  type: 'row';
  /**
   * Child nodes in order.
   */
  children: ViewNode[];
}

/**
 * Grid structural container.
 */
export interface GridNode extends BaseNode {
  type: 'grid';
  /**
   * Explicit column count for grid layout.
   */
  columns?: number;
  /**
   * Child nodes in order.
   */
  children: ViewNode[];
}

/**
 * Portable field validation metadata.
 */
export interface FieldConstraints {
  /**
   * Whether a value is required.
   */
  required?: boolean;
  /**
   * Inclusive minimum for numeric values.
   */
  min?: number;
  /**
   * Inclusive maximum for numeric values.
   */
  max?: number;
  /**
   * Minimum string length.
   */
  minLength?: number;
  /**
   * Maximum string length.
   */
  maxLength?: number;
  /**
   * Regex pattern string for value validation.
   */
  pattern?: string;
}

/**
 * Declares an allowed data-shape transition when a node changes structure.
 */
export interface MigrationRule {
  /**
   * Source node hash.
   */
  fromHash: string;
  /**
   * Destination node hash.
   */
  toHash: string;
  /**
   * Identifier matching a registered migration strategy.
   */
  strategyId?: string;
}

/**
 * Returns child nodes for recursive traversal.
 */
export function getChildNodes(node: ViewNode): ViewNode[] {
  if (node.type === 'group' || node.type === 'row' || node.type === 'grid') {
    return (node as any).children;
  }
  if (node.type === 'collection') {
    return [node.template];
  }
  return [];
}
