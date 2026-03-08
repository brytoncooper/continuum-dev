import type {
  CollectionNodeState,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { PlaygroundCollectionScenario } from '../types';

function node(definition: Record<string, unknown>): ViewNode {
  return definition as unknown as ViewNode;
}

function collectionValue(
  items: Array<{ values: Record<string, NodeValue> }>
): NodeValue<CollectionNodeState> {
  return {
    value: {
      items,
    },
    isDirty: true,
  };
}

const initialView: ViewDefinition = {
  viewId: 'playground-collection-evolution',
  version: '1',
  nodes: [
    {
      id: 'lead_contacts',
      key: 'deal.contacts',
      type: 'collection',
      label: 'Lead contacts',
      minItems: 2,
      template: {
        id: 'contact_row',
        type: 'row',
        children: [
          {
            id: 'contact_name',
            key: 'contact.name',
            type: 'field',
            dataType: 'string',
            label: 'Name',
            placeholder: 'Enter Name',
          },
          {
            id: 'contact_company',
            key: 'contact.company',
            type: 'field',
            dataType: 'string',
            label: 'Company',
            placeholder: 'Enter Company',
          },
        ],
      },
    },
  ],
};

const evolvedView: ViewDefinition = {
  viewId: 'playground-collection-evolution',
  version: '2',
  nodes: [
    {
      id: 'lead_contacts',
      key: 'deal.contacts',
      type: 'collection',
      label: 'Lead contacts',
      minItems: 2,
      template: {
        id: 'contact_card',
        type: 'group',
        label: 'Contact card',
        children: [
          {
            id: 'identity_row',
            type: 'row',
            children: [
              {
                id: 'contact_name_v2',
                key: 'contact.name',
                type: 'field',
                dataType: 'string',
                label: 'Name',
                placeholder: 'Enter Name',
              },
              {
                id: 'contact_company_v2',
                key: 'contact.company',
                type: 'field',
                dataType: 'string',
                label: 'Company',
                placeholder: 'Enter Company',
              },
            ],
          },
          node({
            id: 'contact_status',
            type: 'select',
            label: 'Status',
            options: [
              { value: 'new', label: 'New' },
              { value: 'active', label: 'Active' },
              { value: 'qualified', label: 'Qualified' },
            ],
          }),
        ],
      },
    },
  ],
};

export const collectionEvolutionScenario: PlaygroundCollectionScenario = {
  id: 'collection-evolution',
  kind: 'collection-evolution',
  title:
    'Collection items should keep the user data they already hold when each repeated item evolves.',
  selectorLabel: 'Collection evolution',
  problem:
    'The user fills in two repeated contact rows. Then the AI upgrades each collection item into a richer card layout with a new container path. Without continuity, those repeated values fall off because the item field ids no longer line up.',
  whyItMatters:
    'Generated UIs do not just mutate one field at a time. They often evolve repeated structures in-place. If every item loses its data during that upgrade, repeated workflows feel fragile immediately.',
  controls: {
    inputLabel: 'Starting form values',
    inputDescription:
      'Seed two repeated contacts here. Both panes replay the same collection evolution next.',
    helperText: '',
  },
  inputFields: [
    {
      key: 'contact.0.name',
      label: 'First contact name',
      placeholder: 'Enter Name',
    },
    {
      key: 'contact.0.company',
      label: 'First contact company',
      placeholder: 'Enter Company',
    },
    {
      key: 'contact.1.name',
      label: 'Second contact name',
      placeholder: 'Enter Name',
    },
    {
      key: 'contact.1.company',
      label: 'Second contact company',
      placeholder: 'Enter Company',
    },
  ],
  defaultInputValues: {
    'contact.0.name': 'Bryton Cooper',
    'contact.0.company': 'Continuum',
    'contact.1.name': 'Morgan Hale',
    'contact.1.company': 'Northstar Labs',
  },
  collectionNodeId: 'lead_contacts',
  collectionKey: 'deal.contacts',
  buildCollectionValue(inputValues) {
    return collectionValue([
      {
        values: {
          'contact_row/contact_name': {
            value: inputValues['contact.0.name'],
            isDirty: true,
          },
          'contact_row/contact_company': {
            value: inputValues['contact.0.company'],
            isDirty: true,
          },
        },
      },
      {
        values: {
          'contact_row/contact_name': {
            value: inputValues['contact.1.name'],
            isDirty: true,
          },
          'contact_row/contact_company': {
            value: inputValues['contact.1.company'],
            isDirty: true,
          },
        },
      },
    ]);
  },
  nextProblems: [
    'Collection item reordering with stronger item identity hints',
    'Nested collections that evolve under a changing parent template',
    'Mixed repeated items where only part of the template changes',
  ],
  steps: [
    {
      id: 'collection-initial',
      title: 'Step 1: The user fills repeated rows',
      description:
        'Both panes start with the same two collection items already filled in.',
      view: initialView,
    },
    {
      id: 'collection-evolved',
      title: 'Step 2: The AI upgrades each item into a richer card layout',
      description:
        'The repeated item template gains a new container path and one new status field. Continuum remaps the existing item values into the new item shape.',
      view: evolvedView,
    },
  ],
};
