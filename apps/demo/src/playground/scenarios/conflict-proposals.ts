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
          type: 'textarea',
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
          type: 'textarea',
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
    'The user has already filled out five profile fields. A later deterministic AI pass tries to replace three of them. Without continuity, those user values are overwritten directly. With Continuum, the same update becomes proposals the user can accept or reject.',
  whyItMatters:
    'This is the next honest failure mode after state drop: even when the field survives, a naive pipeline can still clobber what the user already entered.',
  controls: {
    helperText:
      'Step 1 loads the user-entered profile. Step 2 runs the deterministic AI pass that tries to replace three of those values.',
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
    'profile.company': { value: 'Northstar Labs', isDirty: true },
    'profile.location': { value: 'Seattle, WA', isDirty: true },
    'profile.notes': {
      value: 'Customer interviews completed and launch notes are drafted.',
      isDirty: true,
    },
  },
  proposedValues: {
    'profile.title': { value: 'Staff Product Designer' },
    'profile.company': { value: 'Continuum Labs' },
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
      title: 'Step 1: User-entered values are loaded',
      description:
        'Both panes start with the same five dirty fields already filled in by the user.',
      view: initialView,
    },
    {
      id: 'deterministic-ai-pass',
      title: 'Step 2: A deterministic AI pass tries to replace three fields',
      description:
        'The next update keeps the same form but attempts to replace title, company, and notes with AI-authored values.',
      view: evolvedView,
    },
  ],
};
