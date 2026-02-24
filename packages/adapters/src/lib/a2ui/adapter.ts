import type {
  SchemaSnapshot,
  ComponentDefinition,
  ComponentState,
} from '@continuum/contract';
import type { ProtocolAdapter } from '../adapter.js';
import type { A2UIForm, A2UIField } from './types.js';

const TYPE_MAP: Record<string, string> = {
  TextInput: 'input',
  TextArea: 'textarea',
  Dropdown: 'select',
  SelectionInput: 'select',
  Switch: 'toggle',
  Toggle: 'toggle',
  DateInput: 'date',
  Section: 'container',
  Card: 'container',
};

const CONTAINER_TYPES = new Set(['Section', 'Card']);

let counter = 0;

function generateId(field: A2UIField): string {
  if (field.name) return field.name;
  counter++;
  return `${field.type.toLowerCase()}_${counter}`;
}

function resetCounter(): void {
  counter = 0;
}

function fieldToComponent(field: A2UIField): ComponentDefinition {
  const id = generateId(field);
  const type = TYPE_MAP[field.type] ?? 'default';

  const def: ComponentDefinition = { id, type, key: id };

  if (field.label) {
    def.path = field.label;
  }

  if (field.options) {
    def.stateShape = field.options;
  }

  if (CONTAINER_TYPES.has(field.type) && field.fields) {
    def.children = field.fields.map(fieldToComponent);
  }

  return def;
}

function componentToField(def: ComponentDefinition): A2UIField {
  const reverseMap: Record<string, string> = {
    input: 'TextInput',
    textarea: 'TextArea',
    select: 'Dropdown',
    toggle: 'Switch',
    date: 'DateInput',
    container: 'Section',
    default: 'Section',
  };

  const field: A2UIField = {
    name: def.id,
    type: reverseMap[def.type] ?? 'TextInput',
    label: def.path ?? def.key ?? def.id,
  };

  if (def.stateShape && Array.isArray(def.stateShape)) {
    field.options = def.stateShape as { id: string; label: string }[];
  }

  if (def.children && def.children.length > 0) {
    field.fields = def.children.map(componentToField);
  }

  return field;
}

function stateForType(type: string): ComponentState {
  switch (type) {
    case 'toggle':
      return { checked: false };
    case 'select':
      return { selectedIds: [] as string[] };
    default:
      return { value: '' };
  }
}

export const a2uiAdapter: ProtocolAdapter<A2UIForm, Record<string, unknown>> = {
  name: 'a2ui',

  toSchema(form: A2UIForm): SchemaSnapshot {
    resetCounter();
    return {
      schemaId: form.id ?? 'a2ui-form',
      version: form.version ?? '1.0',
      components: form.fields.map(fieldToComponent),
    };
  },

  fromSchema(snapshot: SchemaSnapshot): A2UIForm {
    return {
      id: snapshot.schemaId,
      version: snapshot.version,
      fields: snapshot.components.map(componentToField),
    };
  },

  toState(externalData: Record<string, unknown>): Record<string, ComponentState> {
    const result: Record<string, ComponentState> = {};
    for (const [key, val] of Object.entries(externalData)) {
      if (typeof val === 'boolean') {
        result[key] = { checked: val };
      } else if (Array.isArray(val)) {
        result[key] = { selectedIds: val as string[] };
      } else {
        result[key] = { value: String(val ?? '') };
      }
    }
    return result;
  },

  fromState(state: Record<string, ComponentState>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(state)) {
      const raw = val as Record<string, unknown>;
      if ('checked' in raw) {
        result[key] = raw['checked'];
      } else if ('selectedIds' in raw) {
        result[key] = raw['selectedIds'];
      } else if ('value' in raw) {
        result[key] = raw['value'];
      } else {
        result[key] = raw;
      }
    }
    return result;
  },
};

export { stateForType, resetCounter };
