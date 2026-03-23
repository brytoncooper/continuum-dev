import type { ViewDefinition } from '@continuum-dev/contract';
import type { PlaygroundStateDropScenario } from '../types';

const initialView: ViewDefinition = {
  viewId: 'playground-name-carry',
  version: '1',
  nodes: [
    {
      id: 'full_name',
      key: 'person.name',
      type: 'field',
      dataType: 'string',
      label: 'Full name',
      placeholder: 'Enter Name',
    },
  ],
};

const evolvedView: ViewDefinition = {
  viewId: 'playground-name-carry',
  version: '2',
  nodes: [
    {
      id: 'identity_details',
      type: 'group',
      label: 'Identity details',
      children: [
        {
          id: 'legal_name',
          key: 'person.name',
          type: 'field',
          dataType: 'string',
          label: 'Legal name',
          placeholder: 'Enter Name',
        },
      ],
    },
  ],
};

export const simpleStateDropScenario: PlaygroundStateDropScenario = {
  id: 'field-id-change',
  kind: 'state-drop',
  title: 'A renamed field should not erase what the user typed.',
  selectorLabel: 'Renamed field',
  problem:
    'Type a name, then go to step 2. The naive pane loses it. Continuum keeps it.',
  whyItMatters: 'Structure changes. User intent should not.',
  trackedField: {
    key: 'person.name',
    label: 'Name',
  },
  controls: {
    inputLabel: 'Your name',
    inputDescription: 'Enter a name to use in both panes.',
    inputPlaceholder: 'Enter Name',
    inputValue: 'Bryton Cooper',
    helperText: 'Go to step 2 to see what happens.',
  },
  nextProblems: [
    'Wrapped fields that move under new containers',
    'Reordered sections with the same semantic fields',
    'Collections that evolve while users already have item data',
  ],
  steps: [
    {
      id: 'initial-form',
      title: 'Step 1: Enter a name',
      description: 'Type a name in the field.',
      view: initialView,
    },
    {
      id: 'ai-update',
      title: 'Step 2: The form changes',
      description: 'The field moves and gets renamed.',
      view: evolvedView,
    },
  ],
};
