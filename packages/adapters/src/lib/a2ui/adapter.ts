import {
  getChildNodes,
  type ViewDefinition,
  type ViewNode,
  type FieldNode,
  type GroupNode,
  type NodeValue,
} from '@continuum-dev/contract';
import type { ProtocolAdapter } from '../adapter.js';
import type { A2UIForm, A2UIField } from './types.js';

const DATA_TYPE_MAP: Record<string, 'string' | 'number' | 'boolean'> = {
  TextInput: 'string',
  TextArea: 'string',
  Dropdown: 'string',
  SelectionInput: 'string',
  Switch: 'boolean',
  Toggle: 'boolean',
  DateInput: 'string',
};

const CONTAINER_TYPES = new Set(['Section', 'Card']);

function convertA2UIFieldToViewNode(
  field: A2UIField,
  nextGeneratedId: () => number
): ViewNode {
  const rawType = typeof field.type === 'string' ? field.type : 'default';
  const id = field.name ?? `${rawType.toLowerCase()}_${nextGeneratedId()}`;

  if (CONTAINER_TYPES.has(rawType)) {
    const children = Array.isArray(field.fields)
      ? field.fields.map((child) =>
          convertA2UIFieldToViewNode(child, nextGeneratedId)
        )
      : [];
    const node: GroupNode = {
      id,
      type: 'group',
      key: id,
      children,
    };
    if (field.label) {
      node.label = field.label;
    }
    return node;
  }

  const dataType = DATA_TYPE_MAP[rawType] ?? 'string';
  const node: FieldNode = {
    id,
    type: 'field',
    key: id,
    dataType,
  };

  if (field.label) {
    node.label = field.label;
  }

  if (field.options) {
    node.options = field.options.map((o) => ({
      value: o.id,
      label: o.label,
      id: o.id,
    })) as FieldNode['options'];
  }

  return node;
}

function convertViewNodeToA2UIField(node: ViewNode): A2UIField {
  const dataTypeToA2UI: Record<string, string> = {
    string: 'TextInput',
    number: 'TextInput',
    boolean: 'Switch',
  };

  let type: string;
  let label: string | undefined;

  switch (node.type) {
    case 'group':
      type = 'Section';
      label = node.label ?? node.key ?? node.id;
      break;
    case 'collection':
      type = 'Section';
      label = node.label ?? node.key ?? node.id;
      break;
    case 'field':
      type = dataTypeToA2UI[node.dataType] ?? 'TextInput';
      label = node.label ?? node.key ?? node.id;
      break;
    case 'action':
      type = 'TextInput';
      label = node.label ?? node.key ?? node.id;
      break;
    case 'presentation':
      type = 'TextInput';
      label = node.key ?? node.id;
      break;
    default: {
      const n = node as unknown as { id: string; key?: string };
      type = 'TextInput';
      label = n.key ?? n.id;
      break;
    }
  }

  const field: A2UIField = { name: node.id, type, label };

  if (node.type === 'field' && node.options) {
    field.options = node.options.map((o) => {
      const legacyId = (o as unknown as { id?: string }).id;
      return { id: legacyId ?? o.value, label: o.label };
    });
  }

  const children = getChildNodes(node);
  if (children.length > 0) {
    field.fields = children.map(convertViewNodeToA2UIField);
  }

  return field;
}

function createDefaultNodeValue(dataType: string): NodeValue {
  switch (dataType) {
    case 'boolean':
      return { value: false };
    case 'number':
      return { value: 0 };
    default:
      return { value: '' };
  }
}

export const a2uiAdapter: ProtocolAdapter<A2UIForm, Record<string, unknown>> = {
  name: 'a2ui',

  toView(form: A2UIForm): ViewDefinition {
    let generatedId = 0;
    const nextGeneratedId = () => {
      generatedId += 1;
      return generatedId;
    };

    const fields = Array.isArray(form.fields) ? form.fields : [];

    return {
      viewId: form.id ?? 'a2ui-form',
      version: form.version ?? '1.0',
      nodes: fields.map((field) =>
        convertA2UIFieldToViewNode(field, nextGeneratedId)
      ),
    };
  },

  fromView(definition: ViewDefinition): A2UIForm {
    return {
      id: definition.viewId,
      version: definition.version,
      fields: definition.nodes.map(convertViewNodeToA2UIField),
    };
  },

  toState(externalData: Record<string, unknown>): Record<string, NodeValue> {
    const result: Record<string, NodeValue> = {};
    for (const [key, val] of Object.entries(externalData)) {
      result[key] = { value: val ?? '' };
    }
    return result;
  },

  fromState(state: Record<string, NodeValue>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(state)) {
      if (val == null) {
        result[key] = val;
        continue;
      }
      result[key] = val.value;
    }
    return result;
  },
};

export { createDefaultNodeValue, createDefaultNodeValue as valueForDataType };
