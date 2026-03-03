import { describe, it, expect } from 'vitest';
import type { FieldNode, GroupNode } from '@continuum/contract';
import { a2uiAdapter } from './adapter.js';
import type { A2UIForm } from './types.js';

describe('a2uiAdapter', () => {
  describe('toView', () => {
    it('maps TextInput to field node with string dataType', () => {
      const form: A2UIForm = {
        id: 'test',
        version: '1.0',
        fields: [{ name: 'username', type: 'TextInput', label: 'Username' }],
      };

      const view = a2uiAdapter.toView(form);

      expect(view.nodes).toHaveLength(1);
      expect(view.nodes[0]).toMatchObject({
        id: 'username',
        type: 'field',
        key: 'username',
        dataType: 'string',
        label: 'Username',
      });
    });

    it('maps TextArea to field node with string dataType', () => {
      const form: A2UIForm = {
        fields: [{ name: 'bio', type: 'TextArea', label: 'Biography' }],
      };

      const view = a2uiAdapter.toView(form);

      expect(view.nodes[0]).toMatchObject({
        id: 'bio',
        type: 'field',
        key: 'bio',
        dataType: 'string',
      });
    });

    it('maps Dropdown to field node with options', () => {
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

      const view = a2uiAdapter.toView(form);

      expect(view.nodes[0]).toMatchObject({
        id: 'country',
        type: 'field',
        dataType: 'string',
        options: [
          { id: 'us', label: 'United States' },
          { id: 'uk', label: 'United Kingdom' },
        ],
      });
    });

    it('maps SelectionInput to field node', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'role',
            type: 'SelectionInput',
            options: [{ id: 'admin', label: 'Admin' }],
          },
        ],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0]).toMatchObject({ type: 'field', dataType: 'string' });
    });

    it('maps Switch to field node with boolean dataType', () => {
      const form: A2UIForm = {
        fields: [{ name: 'notifications', type: 'Switch', label: 'Notifications' }],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0]).toMatchObject({
        id: 'notifications',
        type: 'field',
        dataType: 'boolean',
      });
    });

    it('maps Toggle to field node with boolean dataType', () => {
      const form: A2UIForm = {
        fields: [{ name: 'dark_mode', type: 'Toggle' }],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0]).toMatchObject({ type: 'field', dataType: 'boolean' });
    });

    it('maps DateInput to field node with string dataType', () => {
      const form: A2UIForm = {
        fields: [{ name: 'birthday', type: 'DateInput', label: 'Date of Birth' }],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0]).toMatchObject({
        id: 'birthday',
        type: 'field',
        dataType: 'string',
        label: 'Date of Birth',
      });
    });

    it('maps Section with nested fields to group node with children', () => {
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

      const view = a2uiAdapter.toView(form);

      expect(view.nodes[0]).toMatchObject({
        id: 'personal',
        type: 'group',
      });
      const personalNode = view.nodes[0] as GroupNode;
      expect(personalNode.children).toHaveLength(2);
      expect(personalNode.children[0]).toMatchObject({
        id: 'first',
        type: 'field',
        dataType: 'string',
      });
      expect(personalNode.children[1]).toMatchObject({
        id: 'last',
        type: 'field',
        dataType: 'string',
      });
    });

    it('maps Card to group node', () => {
      const form: A2UIForm = {
        fields: [
          {
            name: 'card1',
            type: 'Card',
            fields: [{ name: 'inner', type: 'TextInput' }],
          },
        ],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0].type).toBe('group');
      expect((view.nodes[0] as GroupNode).children).toHaveLength(1);
    });

    it('falls back to string dataType for unknown field types', () => {
      const form: A2UIForm = {
        fields: [{ name: 'custom', type: 'FancyWidget' }],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.nodes[0]).toMatchObject({ type: 'field', dataType: 'string' });
    });

    it('generates deterministic IDs for fields without names', () => {
      const form: A2UIForm = {
        fields: [
          { type: 'TextInput', label: 'First' },
          { type: 'TextInput', label: 'Second' },
        ],
      };

      const view = a2uiAdapter.toView(form);

      expect(view.nodes[0].id).toBe('textinput_1');
      expect(view.nodes[1].id).toBe('textinput_2');
    });

    it('generates the same IDs across repeated toView calls', () => {
      const form: A2UIForm = {
        fields: [
          { type: 'TextInput' },
          { type: 'TextInput' },
        ],
      };

      const first = a2uiAdapter.toView(form);
      const second = a2uiAdapter.toView(form);

      expect(first.nodes.map((node) => node.id)).toEqual(
        second.nodes.map((node) => node.id)
      );
    });

    it('uses form id and version when provided', () => {
      const form: A2UIForm = {
        id: 'my-form',
        version: '2.5',
        fields: [],
      };

      const view = a2uiAdapter.toView(form);
      expect(view.viewId).toBe('my-form');
      expect(view.version).toBe('2.5');
    });

    it('provides defaults for missing id and version', () => {
      const form: A2UIForm = { fields: [] };

      const view = a2uiAdapter.toView(form);
      expect(view.viewId).toBe('a2ui-form');
      expect(view.version).toBe('1.0');
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

      const view = a2uiAdapter.toView(form);
      const outer = view.nodes[0] as GroupNode;
      expect(outer.children).toHaveLength(1);
      const inner = outer.children[0] as GroupNode;
      expect(inner.children).toHaveLength(1);
      expect(inner.children[0].id).toBe('deep');
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

      const view = a2uiAdapter.toView(form);
      expect(view.nodes).toHaveLength(5);

      const dataTypes = view.nodes.map((n) => (n as FieldNode).dataType);
      expect(dataTypes).toEqual(['string', 'string', 'boolean', 'string', 'string']);
    });
  });

  describe('fromView', () => {
    it('converts view back to A2UI form', () => {
      const form: A2UIForm = {
        id: 'round-trip',
        version: '1.0',
        fields: [
          { name: 'email', type: 'TextInput', label: 'Email' },
          { name: 'agree', type: 'Switch', label: 'I Agree' },
        ],
      };

      const view = a2uiAdapter.toView(form);
      const result = a2uiAdapter.fromView!(view);

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

      const view = a2uiAdapter.toView(form);
      const result = a2uiAdapter.fromView!(view);

      expect(result.fields[0].type).toBe('Section');
      expect(result.fields[0].fields).toHaveLength(1);
      expect(result.fields[0].fields![0].name).toBe('field1');
    });

    it('maps node options to A2UI options', () => {
      const result = a2uiAdapter.fromView!({
        viewId: 's',
        version: '1',
        nodes: [
          {
            id: 'country',
            type: 'field',
            dataType: 'string',
            label: 'Country',
            options: [
              { id: 'us', label: 'United States' },
              { id: 'ca', label: 'Canada' },
            ],
          } as any,
        ],
      });

      expect(result.fields[0].options).toEqual([
        { id: 'us', label: 'United States' },
        { id: 'ca', label: 'Canada' },
      ]);
    });
    it('maps collection node to Section', () => {
      const result = a2uiAdapter.fromView!({
        viewId: 's',
        version: '1',
        nodes: [
          {
            id: 'items',
            type: 'collection',
            label: 'My Items',
            template: { id: 'tpl', type: 'field', dataType: 'string' }
          } as any,
        ],
      });

      expect(result.fields[0].type).toBe('Section');
      expect(result.fields[0].name).toBe('items');
      expect(result.fields[0].label).toBe('My Items');
      expect(result.fields[0].fields).toHaveLength(1);
      expect(result.fields[0].fields![0].name).toBe('tpl');
    });

    it('maps action node to TextInput', () => {
      const result = a2uiAdapter.fromView!({
        viewId: 's',
        version: '1',
        nodes: [
          {
            id: 'submit',
            type: 'action',
            intentId: 'run',
            label: 'Submit Button',
          } as any,
        ],
      });

      expect(result.fields[0].type).toBe('TextInput');
      expect(result.fields[0].name).toBe('submit');
      expect(result.fields[0].label).toBe('Submit Button');
    });
  });
  describe('toState', () => {
    it('converts string values to NodeValue', () => {
      const result = a2uiAdapter.toState!({ email: 'test@example.com' });
      expect(result['email']).toEqual({ value: 'test@example.com' });
    });

    it('converts boolean values to NodeValue', () => {
      const result = a2uiAdapter.toState!({ agree: true });
      expect(result['agree']).toEqual({ value: true });
    });

    it('converts array values to NodeValue', () => {
      const result = a2uiAdapter.toState!({ countries: ['us', 'uk'] });
      expect(result['countries']).toEqual({ value: ['us', 'uk'] });
    });

    it('converts number values to NodeValue', () => {
      const result = a2uiAdapter.toState!({ age: 25 });
      expect(result['age']).toEqual({ value: 25 });
    });

    it('converts null/undefined to empty string NodeValue', () => {
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
      expect(result['active']).toEqual({ value: false });
      expect(result['tags']).toEqual({ value: ['a', 'b'] });
    });
  });

  describe('fromState', () => {
    it('extracts value from boolean NodeValue', () => {
      const result = a2uiAdapter.fromState!({ agree: { value: true } });
      expect(result['agree']).toBe(true);
    });

    it('extracts value from array NodeValue', () => {
      const result = a2uiAdapter.fromState!({
        countries: { value: ['us'] },
      });
      expect(result['countries']).toEqual(['us']);
    });

    it('extracts value from string NodeValue', () => {
      const result = a2uiAdapter.fromState!({
        email: { value: 'test@example.com' },
      });
      expect(result['email']).toBe('test@example.com');
    });

    it('extracts value from complex NodeValue', () => {
      const result = a2uiAdapter.fromState!({
        custom: { value: { foo: 'bar' } },
      });
      expect(result['custom']).toEqual({ foo: 'bar' });
    });
  });

  describe('round-trip: A2UI → View → render → state → A2UI data', () => {
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

      const view = a2uiAdapter.toView(form);
      expect(view.nodes).toHaveLength(3);

      const externalData = { name: 'Alice', agree: true, plan: ['pro'] };
      const continuumState = a2uiAdapter.toState!(externalData);
      expect(continuumState['name']).toEqual({ value: 'Alice' });
      expect(continuumState['agree']).toEqual({ value: true });
      expect(continuumState['plan']).toEqual({ value: ['pro'] });

      const backToExternal = a2uiAdapter.fromState!(continuumState);
      expect(backToExternal).toEqual(externalData);

      const backToForm = a2uiAdapter.fromView!(view);
      expect(backToForm.id).toBe('lifecycle');
      expect(backToForm.fields).toHaveLength(3);
    });
  });
});
