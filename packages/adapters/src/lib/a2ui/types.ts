export type A2UIFieldType =
  | 'TextInput'
  | 'TextArea'
  | 'Dropdown'
  | 'SelectionInput'
  | 'Switch'
  | 'Toggle'
  | 'DateInput'
  | 'Section'
  | 'Card';

export interface A2UIOption {
  id: string;
  label: string;
}

export interface A2UIField {
  name?: string;
  type: A2UIFieldType | string;
  label?: string;
  options?: A2UIOption[];
  fields?: A2UIField[];
}

export interface A2UIForm {
  id?: string;
  version?: string;
  title?: string;
  fields: A2UIField[];
}
