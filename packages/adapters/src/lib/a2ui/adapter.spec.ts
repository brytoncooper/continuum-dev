import { describe, it, expect } from 'vitest';
import { a2uiAdapter } from './adapter.js';
import type { A2UIForm } from './types.js';

describe('a2uiAdapter', () => {
  describe('toSchema', () => {
    it('maps TextInput to input component', () => {
      const form: A2UIForm = {
        id: 'test',
        version: '1.0',
        fields: [{ name: 'username', type: 'TextInput', label: 'Username' }],
      };

      const schema = a2uiAdapter.toSchema(form);

      expect(schema.components).toHaveLength(1);
      expect(schema.components[0]).toMatchObject({
        id: 'username',
        type: 'input',
        key: 'username',
        label: 'Username',
      });
    });

    it('maps TextArea to textarea component', () => {
      const form: A2UIForm = {
        fields: [{ name: 'bio', type: 'TextArea', label: 'Biography' }],
      };

      const schema = a2uiAdapter.toSchema(form);

      expect(schema.components[0]).toMatchObject({
        id: 'bio',
        type: 'textarea',
        key: 'bio',
      });
    });

    it('maps Dropdown to select component with options', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'country',
            type: 'Dropdown',
            label: 'Country',
            options: [
              { id: 'us', label: 'United States' },
              { id: 'uk', label: 'United Kingdom' },
            ],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);

      expect(schema.components[0]).toMatchObject({
        id: 'country',
        type: 'select',
        props: {
          options: [
            { id: 'us', label: 'United States' },
            { id: 'uk', label: 'United Kingdom' },
          ],
        },
      });
    });

    it('maps SelectionInput to select component', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'role',
            type: 'SelectionInput',
            options: [{ id: 'admin', label: 'Admin' }],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0].type).toBe('select');
    });

    it('maps Switch to toggle component', () => {
      const form: A2UIForm = {
        fields: [{ name: 'notifications', type: 'Switch', label: 'Notifications' }],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0]).toMatchObject({
        id: 'notifications',
        type: 'toggle',
      });
    });

    it('maps Toggle to toggle component', () => {
      const form: A2UIForm = {
        fields: [{ name: 'dark_mode', type: 'Toggle' }],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0].type).toBe('toggle');
    });

    it('maps DateInput to date component', () => {
      const form: A2UIForm = {
        fields: [{ name: 'birthday', type: 'DateInput', label: 'Date of Birth' }],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0]).toMatchObject({
        id: 'birthday',
        type: 'date',
        label: 'Date of Birth',
      });
    });

    it('maps Section with nested fields to container with children', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'personal',
            type: 'Section',
            label: 'Personal Info',
            fields: [
              { name: 'first', type: 'TextInput', label: 'First Name' },
              { name: 'last', type: 'TextInput', label: 'Last Name' },
            ],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);

      expect(schema.components[0]).toMatchObject({
        id: 'personal',
        type: 'container',
      });
      expect(schema.components[0].children).toHaveLength(2);
      expect(schema.components[0].children![0]).toMatchObject({
        id: 'first',
        type: 'input',
      });
      expect(schema.components[0].children![1]).toMatchObject({
        id: 'last',
        type: 'input',
      });
    });

    it('maps Card to container component', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'card1',
            type: 'Card',
            fields: [{ name: 'inner', type: 'TextInput' }],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0].type).toBe('container');
      expect(schema.components[0].children).toHaveLength(1);
    });

    it('falls back to default for unknown field types', () => {
      const form: A2UIForm = {
        fields: [{ name: 'custom', type: 'FancyWidget' }],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components[0].type).toBe('default');
    });

    it('generates deterministic IDs for fields without names', () => {
      const form: A2UIForm = {
        fields: [
          { type: 'TextInput', label: 'First' },
          { type: 'TextInput', label: 'Second' },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);

      expect(schema.components[0].id).toBe('textinput_1');
      expect(schema.components[1].id).toBe('textinput_2');
    });

    it('generates the same IDs across repeated toSchema calls', () => {
      const form: A2UIForm = {
        fields: [
          { type: 'TextInput' },
          { type: 'TextInput' },
        ],
      };

      const first = a2uiAdapter.toSchema(form);
      const second = a2uiAdapter.toSchema(form);

      expect(first.components.map((component) => component.id)).toEqual(
        second.components.map((component) => component.id)
      );
    });

    it('uses form id and version when provided', () => {
      const form: A2UIForm = {
        id: 'my-form',
        version: '2.5',
        fields: [],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.schemaId).toBe('my-form');
      expect(schema.version).toBe('2.5');
    });

    it('provides defaults for missing id and version', () => {
      const form: A2UIForm = { fields: [] };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.schemaId).toBe('a2ui-form');
      expect(schema.version).toBe('1.0');
    });

    it('handles deeply nested sections', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'outer',
            type: 'Section',
            fields: [
              {
                name: 'inner',
                type: 'Section',
                fields: [{ name: 'deep', type: 'TextInput' }],
              },
            ],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      const outer = schema.components[0];
      expect(outer.children).toHaveLength(1);
      const inner = outer.children![0];
      expect(inner.children).toHaveLength(1);
      expect(inner.children![0].id).toBe('deep');
    });

    it('handles multiple field types in a single form', () => {
      const form: A2UIForm = {
        id: 'multi',
        version: '1.0',
        fields: [
          { name: 'name', type: 'TextInput' },
          { name: 'notes', type: 'TextArea' },
          { name: 'agree', type: 'Switch' },
          { name: 'dob', type: 'DateInput' },
          {
            name: 'country',
            type: 'Dropdown',
            options: [{ id: 'us', label: 'US' }],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components).toHaveLength(5);

      const types = schema.components.map((c) => c.type);
      expect(types).toEqual(['input', 'textarea', 'toggle', 'date', 'select']);
    });
  });

  describe('fromSchema', () => {
    it('converts schema back to A2UI form', () => {
      const form: A2UIForm = {
        id: 'round-trip',
        version: '1.0',
        fields: [
          { name: 'email', type: 'TextInput', label: 'Email' },
          { name: 'agree', type: 'Switch', label: 'I Agree' },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      const result = a2uiAdapter.fromSchema!(schema);

      expect(result.id).toBe('round-trip');
      expect(result.version).toBe('1.0');
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].name).toBe('email');
      expect(result.fields[0].type).toBe('TextInput');
      expect(result.fields[1].name).toBe('agree');
      expect(result.fields[1].type).toBe('Switch');
    });

    it('preserves nested structure in round-trip', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'section',
            type: 'Section',
            label: 'Group',
            fields: [{ name: 'field1', type: 'TextInput', label: 'Field 1' }],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      const result = a2uiAdapter.fromSchema!(schema);

      expect(result.fields[0].type).toBe('Section');
      expect(result.fields[0].fields).toHaveLength(1);
      expect(result.fields[0].fields![0].name).toBe('field1');
    });

    it('maps schema props.options to A2UI options', () => {
      const result = a2uiAdapter.fromSchema({
        schemaId: 's',
        version: '1',
        components: [
          {
            id: 'country',
            type: 'select',
            label: 'Country',
            props: {
              options: [
                { id: 'us', label: 'United States' },
                { id: 'ca', label: 'Canada' },
              ],
            },
          },
        ],
      });

      expect(result.fields[0].options).toEqual([
        { id: 'us', label: 'United States' },
        { id: 'ca', label: 'Canada' },
      ]);
    });
  });

  describe('toState', () => {
    it('converts string values to ValueInputState', () => {
      const result = a2uiAdapter.toState!({ email: 'test@example.com' });
      expect(result['email']).toEqual({ value: 'test@example.com' });
    });

    it('converts boolean values to ToggleState', () => {
      const result = a2uiAdapter.toState!({ agree: true });
      expect(result['agree']).toEqual({ checked: true });
    });

    it('converts array values to SelectionState', () => {
      const result = a2uiAdapter.toState!({ countries: ['us', 'uk'] });
      expect(result['countries']).toEqual({ selectedIds: ['us', 'uk'] });
    });

    it('converts number values to string ValueInputState', () => {
      const result = a2uiAdapter.toState!({ age: 25 });
      expect(result['age']).toEqual({ value: '25' });
    });

    it('converts null/undefined to empty string', () => {
      const result = a2uiAdapter.toState!({ empty: null });
      expect(result['empty']).toEqual({ value: '' });
    });

    it('handles mixed types', () => {
      const result = a2uiAdapter.toState!({
        name: 'Alice',
        active: false,
        tags: ['a', 'b'],
      });

      expect(result['name']).toEqual({ value: 'Alice' });
      expect(result['active']).toEqual({ checked: false });
      expect(result['tags']).toEqual({ selectedIds: ['a', 'b'] });
    });
  });

  describe('fromState', () => {
    it('extracts checked from ToggleState', () => {
      const result = a2uiAdapter.fromState!({ agree: { checked: true } });
      expect(result['agree']).toBe(true);
    });

    it('extracts selectedIds from SelectionState', () => {
      const result = a2uiAdapter.fromState!({
        countries: { selectedIds: ['us'] },
      });
      expect(result['countries']).toEqual(['us']);
    });

    it('extracts value from ValueInputState', () => {
      const result = a2uiAdapter.fromState!({
        email: { value: 'test@example.com' },
      });
      expect(result['email']).toBe('test@example.com');
    });

    it('passes through unknown state shapes', () => {
      const result = a2uiAdapter.fromState!({
        custom: { foo: 'bar' } as Record<string, unknown>,
      });
      expect(result['custom']).toEqual({ foo: 'bar' });
    });
  });

  describe('round-trip: A2UI → Schema → render → state → A2UI data', () => {
    it('full lifecycle preserves data', () => {
      const form: A2UIForm = {
        id: 'lifecycle',
        version: '1.0',
        fields: [
          { name: 'name', type: 'TextInput', label: 'Name' },
          { name: 'agree', type: 'Switch', label: 'Agree' },
          {
            name: 'plan',
            type: 'Dropdown',
            options: [
              { id: 'basic', label: 'Basic' },
              { id: 'pro', label: 'Pro' },
            ],
          },
        ],
      };

      const schema = a2uiAdapter.toSchema(form);
      expect(schema.components).toHaveLength(3);

      const externalData = { name: 'Alice', agree: true, plan: ['pro'] };
      const continuumState = a2uiAdapter.toState!(externalData);
      expect(continuumState['name']).toEqual({ value: 'Alice' });
      expect(continuumState['agree']).toEqual({ checked: true });
      expect(continuumState['plan']).toEqual({ selectedIds: ['pro'] });

      const backToExternal = a2uiAdapter.fromState!(continuumState);
      expect(backToExternal).toEqual(externalData);

      const backToForm = a2uiAdapter.fromSchema!(schema);
      expect(backToForm.id).toBe('lifecycle');
      expect(backToForm.fields).toHaveLength(3);
    });
  });
});
