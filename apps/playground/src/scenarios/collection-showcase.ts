import type { Scenario } from './types';

export const collectionShowcaseScenario: Scenario = {
  id: 'collection-showcase',
  title: 'Collection Items',
  subtitle: 'Test repeatable sections with item add/remove flows',
  capabilityTag: 'Collections',
  steps: [
    {
      id: 'collection-step-1',
      label: 'Step 1',
      description: 'Start with a collection template for line items',
      narrativePrompt: 'Use collection controls to add multiple items.',
      view: {
        viewId: 'invoice-builder',
        version: '1.0',
        nodes: [
          {
            id: 'invoice_title',
            key: 'invoice_title',
            type: 'field',
            hash: 'field:v1',
            label: 'Invoice Name',
          },
          {
            id: 'line_items',
            key: 'line_items',
            type: 'collection',
            label: 'Line Items',
            minItems: 1,
            maxItems: 8,
            template: {
              id: 'line_item_template',
              key: 'line_item_template',
              type: 'group',
              label: 'Line Item',
              children: [
                {
                  id: 'item_name',
                  key: 'item_name',
                  type: 'field',
                  hash: 'field:v1',
                  label: 'Item Name',
                },
                {
                  id: 'item_quantity',
                  key: 'item_quantity',
                  type: 'slider',
                  hash: 'slider:v1',
                  label: 'Quantity',
                  props: { min: 1, max: 20 },
                },
              ],
            },
          },
        ],
      },
      outcomeHint: {
        severity: 'info',
        summary: 'Add line items before moving to the next step.',
      },
    },
    {
      id: 'collection-step-2',
      label: 'Step 2',
      description: 'AI evolves collection template with pricing metadata',
      narrativePrompt: 'Existing collection entries should survive while new fields appear.',
      view: {
        viewId: 'invoice-builder',
        version: '2.0',
        nodes: [
          {
            id: 'invoice_title_v2',
            key: 'invoice_title',
            type: 'field',
            hash: 'field:v1',
            label: 'Invoice Name',
          },
          {
            id: 'line_items_v2',
            key: 'line_items',
            type: 'collection',
            label: 'Line Items',
            minItems: 1,
            maxItems: 12,
            template: {
              id: 'line_item_template_v2',
              key: 'line_item_template',
              type: 'group',
              label: 'Line Item',
              children: [
                {
                  id: 'item_name_v2',
                  key: 'item_name',
                  type: 'field',
                  hash: 'field:v1',
                  label: 'Item Name',
                },
                {
                  id: 'item_quantity_v2',
                  key: 'item_quantity',
                  type: 'slider',
                  hash: 'slider:v1',
                  label: 'Quantity',
                  props: { min: 1, max: 20 },
                },
                {
                  id: 'item_price',
                  key: 'item_price',
                  type: 'field',
                  hash: 'field:v1',
                  label: 'Unit Price',
                },
              ],
            },
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'Collection entries persist while the template gains new fields.',
      },
    },
    {
      id: 'collection-step-3',
      label: 'Step 3',
      description: 'AI removes quantity slider and keeps price fields',
      narrativePrompt: 'Inspect detached values to verify removed nodes are retained.',
      view: {
        viewId: 'invoice-builder',
        version: '3.0',
        nodes: [
          {
            id: 'invoice_title_v3',
            key: 'invoice_title',
            type: 'field',
            hash: 'field:v1',
            label: 'Invoice Name',
          },
          {
            id: 'line_items_v3',
            key: 'line_items',
            type: 'collection',
            label: 'Line Items',
            minItems: 1,
            maxItems: 12,
            template: {
              id: 'line_item_template_v3',
              key: 'line_item_template',
              type: 'group',
              label: 'Line Item',
              children: [
                {
                  id: 'item_name_v3',
                  key: 'item_name',
                  type: 'field',
                  hash: 'field:v1',
                  label: 'Item Name',
                },
                {
                  id: 'item_price_v3',
                  key: 'item_price',
                  type: 'field',
                  hash: 'field:v1',
                  label: 'Unit Price',
                },
              ],
            },
          },
        ],
      },
      outcomeHint: {
        severity: 'warning',
        summary: 'Removed collection fields appear in detached values for safe recovery.',
      },
    },
  ],
};
