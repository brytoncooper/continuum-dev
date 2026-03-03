import type { Scenario } from './types';

export const deepNestingScenario: Scenario = {
  id: 'deep-nesting',
  title: 'Deep Nesting',
  subtitle: 'Track identity through multi-level hierarchy changes',
  capabilityTag: 'Nested Reconciliation',
  steps: [
    {
      id: 'nested-step-1',
      label: 'Step 1',
      description: 'Start with a three-level checkout hierarchy',
      narrativePrompt: 'Populate customer and shipping data before the AI restructures sections.',
      view: {
        viewId: 'checkout-flow',
        version: '1.0',
        nodes: [
          {
            id: 'checkout_root',
            key: 'checkout_root',
            type: 'group',
            label: 'Checkout',
            children: [
              {
                id: 'customer_section',
                key: 'customer_section',
                type: 'group',
                label: 'Customer',
                children: [
                  {
                    id: 'identity_panel',
                    key: 'identity_panel',
                    type: 'group',
                    label: 'Identity',
                    children: [
                      {
                        id: 'first_name',
                        key: 'first_name',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'First Name',
                      },
                      {
                        id: 'last_name',
                        key: 'last_name',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Last Name',
                      },
                    ],
                  },
                ],
              },
              {
                id: 'shipping_section',
                key: 'shipping_section',
                type: 'group',
                label: 'Shipping',
                children: [
                  {
                    id: 'shipping_address_panel',
                    key: 'shipping_address_panel',
                    type: 'group',
                    label: 'Address',
                    children: [
                      {
                        id: 'street',
                        key: 'street',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Street',
                      },
                      {
                        id: 'city',
                        key: 'city',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'City',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      initialState: {
        first_name: { value: 'Avery' },
        last_name: { value: 'Nguyen' },
        city: { value: 'Seattle' },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'Three levels are active: root -> section -> panel -> field.',
      },
    },
    {
      id: 'nested-step-2',
      label: 'Step 2',
      description: 'AI splits shipping into billing and delivery branches',
      narrativePrompt: 'Node ids change and hierarchy shifts while keys remain stable.',
      view: {
        viewId: 'checkout-flow',
        version: '2.0',
        nodes: [
          {
            id: 'checkout_root_v2',
            key: 'checkout_root',
            type: 'group',
            label: 'Checkout',
            children: [
              {
                id: 'buyer_section',
                key: 'customer_section',
                type: 'group',
                label: 'Buyer',
                children: [
                  {
                    id: 'name_group',
                    key: 'identity_panel',
                    type: 'group',
                    label: 'Name',
                    children: [
                      {
                        id: 'given_name',
                        key: 'first_name',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Given Name',
                      },
                      {
                        id: 'family_name',
                        key: 'last_name',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Family Name',
                      },
                    ],
                  },
                ],
              },
              {
                id: 'delivery_section',
                key: 'shipping_section',
                type: 'group',
                label: 'Delivery',
                children: [
                  {
                    id: 'delivery_address',
                    key: 'shipping_address_panel',
                    type: 'group',
                    label: 'Delivery Address',
                    children: [
                      {
                        id: 'street_line',
                        key: 'street',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Street',
                      },
                      {
                        id: 'city_name',
                        key: 'city',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'City',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'Values carry across id and hierarchy changes because semantic keys are stable.',
      },
    },
    {
      id: 'nested-step-3',
      label: 'Step 3',
      description: 'AI introduces a type mismatch in city',
      narrativePrompt: 'City changes from text field to slider to demonstrate a targeted reset.',
      view: {
        viewId: 'checkout-flow',
        version: '3.0',
        nodes: [
          {
            id: 'checkout_root_v3',
            key: 'checkout_root',
            type: 'group',
            label: 'Checkout',
            children: [
              {
                id: 'delivery_section',
                key: 'shipping_section',
                type: 'group',
                label: 'Delivery',
                children: [
                  {
                    id: 'delivery_address',
                    key: 'shipping_address_panel',
                    type: 'group',
                    label: 'Delivery Address',
                    children: [
                      {
                        id: 'street_line',
                        key: 'street',
                        type: 'field',
                        hash: 'field:v1',
                        label: 'Street',
                      },
                      {
                        id: 'city_importance',
                        key: 'city',
                        type: 'slider',
                        hash: 'slider:v1',
                        label: 'City Importance',
                        props: { min: 0, max: 100 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'warning',
        summary: 'Only city resets because its component type changed.',
      },
    },
  ],
};
