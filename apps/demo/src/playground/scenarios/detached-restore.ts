import type {
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import type { PlaygroundDetachedScenario } from '../types';

function node(definition: Record<string, unknown>): ViewNode {
  return definition as unknown as ViewNode;
}

const initialView: ViewDefinition = {
  viewId: 'playground-detached-restore',
  version: '1',
  nodes: [
    {
      id: 'profile_detached_details',
      type: 'group',
      label: 'Profile details',
      children: [
        {
          id: 'detached_name',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'detached_title',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        {
          id: 'detached_location',
          key: 'profile.location',
          type: 'field',
          dataType: 'string',
          label: 'Location',
          placeholder: 'Enter Location',
        },
        node({
          id: 'detached_notes',
          key: 'profile.notes',
          type: 'field',
          dataType: 'string',
          label: 'Notes',
          placeholder: 'Enter Notes',
        }),
      ],
    },
  ],
};

const detachedView: ViewDefinition = {
  viewId: 'playground-detached-restore',
  version: '2',
  nodes: [
    {
      id: 'profile_detached_details',
      type: 'group',
      label: 'Profile details',
      children: [
        {
          id: 'detached_name',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'detached_title',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        node({
          id: 'detached_notes_summary',
          key: 'profile.notes',
          type: 'presentation',
          contentType: 'text',
          content: 'AI collapsed notes into a generated summary card for now.',
        }),
      ],
    },
  ],
};

const restoredView: ViewDefinition = {
  viewId: 'playground-detached-restore',
  version: '3',
  nodes: [
    {
      id: 'profile_detached_details',
      type: 'group',
      label: 'Profile details',
      children: [
        {
          id: 'detached_name_returned',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'detached_title_returned',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        {
          id: 'detached_location_returned',
          key: 'profile.location',
          type: 'field',
          dataType: 'string',
          label: 'Location',
          placeholder: 'Enter Location',
        },
        node({
          id: 'detached_notes_returned',
          key: 'profile.notes',
          type: 'field',
          dataType: 'string',
          label: 'Notes',
          placeholder: 'Enter Notes',
        }),
      ],
    },
  ],
};

export const detachedRestoreScenario: PlaygroundDetachedScenario = {
  id: 'detached-restore',
  kind: 'detached-restore',
  title:
    'Removed or incompatible fields should come back with their prior user data intact.',
  selectorLabel: 'Detached restore',
  problem:
    'Start with four filled fields. Go to step 2, some fields disappear. Go to step 3, they return. The naive pane loses the data. Continuum brings it back.',
  whyItMatters:
    'Fields can disappear and return. The data should come back with them.',
  controls: {
    helperText:
      'Step 1: filled values. Step 2: fields removed. Step 3: fields and data return.',
  },
  trackedFields: [
    { key: 'profile.name', label: 'Name' },
    { key: 'profile.title', label: 'Title' },
    { key: 'profile.location', label: 'Location' },
    { key: 'profile.notes', label: 'Notes' },
  ],
  initialValues: {
    'profile.name': { value: 'Bryton Cooper', isDirty: true },
    'profile.title': { value: 'Senior Product Designer', isDirty: true },
    'profile.location': { value: 'Boise, ID', isDirty: true },
    'profile.notes': {
      value: 'Customer interviews completed and launch notes are drafted.',
      isDirty: true,
    } as NodeValue,
  },
  detachedReasons: {
    'profile.location': 'node-removed',
    'profile.notes': 'type-mismatch',
  },
  restoredKeys: ['profile.location', 'profile.notes'],
  nextProblems: [
    'Detached values inside collections and nested groups',
    'Restoration after the field returns under a different parent path',
    'Recovery policies for long-lived detached state across many pushes',
  ],
  steps: [
    {
      id: 'initial-values',
      title: 'Step 1: Filled values',
      description:
        'Both panes start with the same entered values.',
      view: initialView,
    },
    {
      id: 'fields-removed',
      title: 'Step 2: Fields removed',
      description:
        'Some fields disappear. Continuum saves the data.',
      view: detachedView,
    },
    {
      id: 'fields-return',
      title: 'Step 3: Fields return',
      description:
        'Fields come back. Continuum restores the data.',
      view: restoredView,
    },
  ],
};
