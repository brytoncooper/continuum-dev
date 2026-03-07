import type { ViewDefinition } from '@continuum/contract';
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
    'The user enters a name. Then the next deterministic view wraps that field in a group and gives it a new id. Without continuity, the state falls off because the original node id no longer exists.',
  whyItMatters:
    'This is the smallest honest version of the continuity problem: the meaning of the field stayed the same, but the structure changed enough that naive state models drop the value.',
  trackedField: {
    key: 'person.name',
    label: 'Name',
  },
  controls: {
    inputLabel: 'User enters',
    inputDescription:
      'Type once here. Both panes replay the same deterministic user action and the same view evolution.',
    inputPlaceholder: 'Enter Name',
    inputValue: 'Bryton Cooper',
    helperText:
      'Move to step 2 to simulate the deterministic AI update that changes the form structure.',
  },
  nextProblems: [
    'Wrapped fields that move under new containers',
    'Reordered sections with the same semantic fields',
    'Collections that evolve while users already have item data',
  ],
  steps: [
    {
      id: 'initial-form',
      title: 'Step 1: User enters data',
      description: 'The first view renders a single field with a stable semantic key.',
      view: initialView,
    },
    {
      id: 'ai-update',
      title: 'Step 2: The form evolves',
      description:
        'The next deterministic view wraps the field in a group and renames its id while keeping the same semantic meaning.',
      view: evolvedView,
    },
  ],
};
