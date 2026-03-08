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
    'The user already entered values. Then the AI removes one field entirely and changes another into an incompatible node type. Without Continuum, that data is gone or reset. With Continuum, the values are detached, preserved, and restored automatically when compatible fields return.',
  whyItMatters:
    'Dynamic forms do more than reorder fields. They can delete sections for a while or swap a field into a different node type entirely. If the original field comes back later, users should not have to re-enter everything.',
  controls: {
    helperText:
      'Step 1 loads the original values. Step 2 removes one field and changes another into an incompatible type. Step 3 brings compatible fields back and shows whether prior values return.',
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
      id: 'detached-initial-values',
      title: 'Step 1: The user already filled out the original fields',
      description:
        'Both panes start from the same dirty user data before the view evolves.',
      view: initialView,
    },
    {
      id: 'detached-and-type-changed',
      title:
        'Step 2: One field disappears and another changes to an incompatible type',
      description:
        'Location is removed entirely while notes becomes a generated presentation node. Continuum detaches those prior values instead of losing them.',
      view: detachedView,
    },
    {
      id: 'restored-fields-return',
      title: 'Step 3: Compatible fields return',
      description:
        'The original field shapes come back with new ids. Continuum restores the detached values automatically when the matching keys and compatible node types return.',
      view: restoredView,
    },
  ],
};
