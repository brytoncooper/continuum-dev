import {
  buildViewDefinitionNodeFromDsl,
  bumpVersion,
} from './node-definition.js';
import type { ViewLineDslNode } from './types.js';

describe('view line dsl node definition builder', () => {
  it.each([
    ['7', '8'],
    ['version9', 'version10'],
    ['draft', 'draft-next'],
  ])('bumps version %s to %s', (input, expected) => {
    expect(bumpVersion(input)).toBe(expected);
  });

  it('coerces scalar defaults and field data types', () => {
    const node: ViewLineDslNode = {
      type: 'field',
      attrs: {
        id: 'age',
        key: 'age',
        label: 'Age',
        dataType: 'number',
        defaultValue: '42',
      },
      children: [],
    };

    expect(buildViewDefinitionNodeFromDsl(node)).toEqual({
      id: 'age',
      type: 'field',
      key: 'age',
      label: 'Age',
      dataType: 'number',
      defaultValue: 42,
    });
  });

  it('builds select options and action defaults', () => {
    const selectNode: ViewLineDslNode = {
      type: 'select',
      attrs: {
        id: 'plan',
        key: 'plan',
        label: 'Plan',
        options: 'basic:Basic|pro:Pro|enterprise',
      },
      children: [],
    };

    const actionNode: ViewLineDslNode = {
      type: 'action',
      attrs: {
        id: 'save_profile',
      },
      children: [],
    };

    expect(buildViewDefinitionNodeFromDsl(selectNode)).toEqual({
      id: 'plan',
      type: 'select',
      key: 'plan',
      label: 'Plan',
      options: [
        { value: 'basic', label: 'Basic' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'enterprise' },
      ],
    });

    expect(buildViewDefinitionNodeFromDsl(actionNode)).toEqual({
      id: 'save_profile',
      type: 'action',
      intentId: 'save_profile.submit',
      label: 'Submit',
    });
  });

  it('derives collection default values from template defaults and removes them from the template', () => {
    const node: ViewLineDslNode = {
      type: 'collection',
      attrs: {
        id: 'medications',
        key: 'medications',
        label: 'Medications',
      },
      children: [
        {
          type: 'group',
          attrs: {
            id: 'medication_item',
            label: 'Medication',
          },
          children: [
            {
              type: 'field',
              attrs: {
                id: 'medication_name',
                key: 'medication_name',
                label: 'Medication name',
                dataType: 'string',
                defaultValue: 'Lisinopril',
              },
              children: [],
            },
            {
              type: 'toggle',
              attrs: {
                id: 'active',
                key: 'active',
                label: 'Active',
                defaultValue: 'true',
              },
              children: [],
            },
          ],
        },
      ],
    };

    const result = buildViewDefinitionNodeFromDsl(node) as {
      defaultValues: Array<Record<string, unknown>>;
      template: { children: Array<Record<string, unknown>> };
    };

    expect(result.defaultValues).toEqual([
      {
        medication_name: 'Lisinopril',
        active: true,
      },
    ]);
    expect(result.template.children[0]).not.toHaveProperty('defaultValue');
    expect(result.template.children[1]).not.toHaveProperty('defaultValue');
  });

  it('prefers explicit collection defaultValues and filters out non-object items', () => {
    const node: ViewLineDslNode = {
      type: 'collection',
      attrs: {
        id: 'dependents',
        defaultValues:
          '[{"name":"Ava","relationship":"Child"},7,{"name":"Kai"}]',
      },
      children: [
        {
          type: 'group',
          attrs: {
            id: 'dependent_item',
          },
          children: [
            {
              type: 'field',
              attrs: {
                id: 'dependent_name',
                key: 'name',
                dataType: 'string',
                defaultValue: 'Should be ignored',
              },
              children: [],
            },
          ],
        },
      ],
    };

    const result = buildViewDefinitionNodeFromDsl(node) as {
      defaultValues: Array<Record<string, unknown>>;
      template: { children: Array<Record<string, unknown>> };
    };

    expect(result.defaultValues).toEqual([
      { name: 'Ava', relationship: 'Child' },
      { name: 'Kai' },
    ]);
    expect(result.template.children[0]).not.toHaveProperty('defaultValue');
  });
});
