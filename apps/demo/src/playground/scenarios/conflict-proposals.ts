import type { ViewDefinition } from '@continuum-dev/contract';
import type { PlaygroundConflictScenario } from '../types';

const initialView: ViewDefinition = {
  viewId: 'playground-conflict-proposals',
  version: '1',
  nodes: [
    {
      id: 'profile_details',
      type: 'group',
      label: 'Profile details',
      children: [
        {
          id: 'profile_name',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'profile_title',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        {
          id: 'profile_company',
          key: 'profile.company',
          type: 'field',
          dataType: 'string',
          label: 'Company',
          placeholder: 'Enter Company',
        },
        {
          id: 'profile_location',
          key: 'profile.location',
          type: 'field',
          dataType: 'string',
          label: 'Location',
          placeholder: 'Enter Location',
        },
        {
          id: 'profile_notes',
          key: 'profile.notes',
          type: 'field',
          dataType: 'string',
          label: 'Notes',
          placeholder: 'Enter Notes',
        },
      ],
    },
  ],
};

const evolvedView: ViewDefinition = {
  viewId: 'playground-conflict-proposals',
  version: '2',
  nodes: [
    {
      id: 'profile_details',
      type: 'group',
      label: 'Profile details',
      children: [
        {
          id: 'profile_name',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'profile_title',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        {
          id: 'profile_company',
          key: 'profile.company',
          type: 'field',
          dataType: 'string',
          label: 'Company',
          placeholder: 'Enter Company',
        },
        {
          id: 'profile_location',
          key: 'profile.location',
          type: 'field',
          dataType: 'string',
          label: 'Location',
          placeholder: 'Enter Location',
        },
        {
          id: 'profile_notes',
          key: 'profile.notes',
          type: 'field',
          dataType: 'string',
          label: 'Notes',
          placeholder: 'Enter Notes',
        },
      ],
    },
  ],
};

export const conflictProposalsScenario: PlaygroundConflictScenario = {
  id: 'conflict-proposals',
  kind: 'conflict-proposals',
  title:
    'AI suggestions should not overwrite a form the user already filled out.',
  selectorLabel: 'AI overwrite conflict',
  problem:
    'Start with five filled fields, then go to step 2. AI suggests new values. The naive pane overwrites. Continuum stages suggestions for review.',
  whyItMatters: 'User input needs protection from being overwritten.',
  controls: {
    helperText: 'Step 1 shows user values. Step 2 shows AI suggestions.',
  },
  trackedFields: [
    { key: 'profile.name', label: 'Name' },
    { key: 'profile.title', label: 'Title' },
    { key: 'profile.company', label: 'Company' },
    { key: 'profile.location', label: 'Location' },
    { key: 'profile.notes', label: 'Notes' },
  ],
  initialValues: {
    'profile.name': { value: 'Bryton Cooper', isDirty: true },
    'profile.title': { value: 'Senior Product Designer', isDirty: true },
    'profile.company': { value: 'Continuum Dev', isDirty: true },
    'profile.location': { value: 'Boise, ID', isDirty: true },
    'profile.notes': {
      value: 'Customer interviews completed and launch notes are drafted.',
      isDirty: true,
    },
  },
  proposedValues: {
    'profile.title': { value: 'Staff Product Designer' },
    'profile.company': { value: 'Continuum Dev' },
    'profile.notes': {
      value:
        'AI draft suggests a launch-focused summary with clearer product positioning.',
    },
  },
  nextProblems: [
    'Conflicts inside nested groups and collections',
    'Proposal flows that arrive after the form structure also changes',
    'Bulk review across larger generated forms with mixed untouched and suggested fields',
  ],
  steps: [
    {
      id: 'initial-user-values',
      title: 'Step 1: User values',
      description: 'Both panes start with the same user-entered values.',
      view: initialView,
    },
    {
      id: 'ai-pass',
      title: 'Step 2: AI suggestions arrive',
      description: 'AI proposes new values. See what happens.',
      view: evolvedView,
    },
  ],
};
