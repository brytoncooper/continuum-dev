import type { ViewDefinition } from '@continuum/contract';
import type { PlaygroundConflictScenario } from '../types';

const initialView: ViewDefinition = {
  viewId: 'playground-compound-structure-conflict',
  version: '1',
  nodes: [
    {
      id: 'profile_form',
      type: 'group',
      label: 'Profile draft',
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
  viewId: 'playground-compound-structure-conflict',
  version: '2',
  nodes: [
    {
      id: 'profile_form_v2',
      type: 'group',
      label: 'Profile draft',
      children: [
        {
          id: 'identity_block',
          type: 'group',
          label: 'Identity',
          children: [
            {
              id: 'profile_name_v2',
              key: 'profile.name',
              type: 'field',
              dataType: 'string',
              label: 'Name',
              placeholder: 'Enter Name',
            },
            {
              id: 'profile_title_v2',
              key: 'profile.title',
              type: 'field',
              dataType: 'string',
              label: 'Title',
              placeholder: 'Enter Title',
            },
          ],
        },
        {
          id: 'positioning_block',
          type: 'group',
          label: 'Positioning',
          children: [
            {
              id: 'profile_company_v2',
              key: 'profile.company',
              type: 'field',
              dataType: 'string',
              label: 'Company',
              placeholder: 'Enter Company',
            },
            {
              id: 'profile_notes_v2',
              key: 'profile.notes',
              type: 'textarea',
              label: 'Notes',
              placeholder: 'Enter Notes',
            },
          ],
        },
      ],
    },
  ],
};

export const compoundStructureConflictScenario: PlaygroundConflictScenario = {
  id: 'compound-structure-conflict',
  kind: 'conflict-proposals',
  title: 'A single AI update should be able to restructure the form and still respect dirty user input.',
  selectorLabel: 'Compound update',
  problem:
    'The user has already filled out the draft. Then one deterministic AI pass both reorganizes the form into new sections and proposes replacement values for several dirty fields. Without continuity, the moved fields are overwritten immediately.',
  whyItMatters:
    'Real AI-driven UIs rarely fail in isolation. A single update often changes structure and content at once. That is where continuity has to prove it can keep the right data attached and still protect the user from unwanted overwrites.',
  controls: {
    inputLabel: 'Starting form values',
    inputDescription:
      'Edit the user draft here, then advance one step to run the combined structure change and proposal pass.',
    helperText: '',
  },
  trackedFields: [
    { key: 'profile.name', label: 'Name' },
    { key: 'profile.title', label: 'Title' },
    { key: 'profile.company', label: 'Company' },
    { key: 'profile.notes', label: 'Notes' },
  ],
  initialValues: {
    'profile.name': { value: 'Bryton Cooper', isDirty: true },
    'profile.title': { value: 'Founder', isDirty: true },
    'profile.company': { value: 'Continuum', isDirty: true },
    'profile.notes': {
      value: 'Keep the copy direct, calm, and focused on durable user data.',
      isDirty: true,
    },
  },
  proposedValues: {
    'profile.title': { value: 'Founder and CEO' },
    'profile.company': { value: 'Continuum Labs' },
    'profile.notes': {
      value: 'AI draft wants a sharper company story and a more assertive launch message.',
    },
  },
  nextProblems: [
    'Proposal review across collection items that also change shape',
    'Conflicts that arrive after part of the draft was detached and later restored',
    'Mixed form updates where some fields migrate and others stay put',
  ],
  steps: [
    {
      id: 'compound-initial',
      title: 'Step 1: The user draft is already filled in',
      description: 'Both panes start from the same dirty profile draft.',
      view: initialView,
    },
    {
      id: 'compound-update',
      title: 'Step 2: The AI reorganizes the form and proposes replacements in one pass',
      description:
        'The view moves the fields under new groups while the same update also proposes replacement values for title, company, and notes.',
      view: evolvedView,
    },
  ],
};
