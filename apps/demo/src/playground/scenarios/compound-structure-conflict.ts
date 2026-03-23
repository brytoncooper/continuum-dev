import type { ViewDefinition } from '@continuum-dev/contract';
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
              type: 'field',
              dataType: 'string',
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
  title:
    'A single AI update should be able to restructure the form and still respect dirty user input.',
  selectorLabel: 'Compound update',
  problem:
    'Start with a filled draft. Go to step 2. The layout changes and AI suggests new values. The naive pane overwrites everything. Continuum keeps your values and shows suggestions.',
  whyItMatters:
    'Updates can change structure and content at once. Both need to be handled safely.',
  controls: {
    inputLabel: 'Your draft',
    inputDescription: 'Enter values, go to step 2 to see the change.',
    helperText: 'Step 2 changes layout and shows AI suggestions.',
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
    'profile.company': { value: 'Continuum Dev' },
    'profile.notes': {
      value:
        'AI draft wants a sharper company story and a more assertive launch message.',
    },
  },
  nextProblems: [
    'Proposal review across collection items that also change shape',
    'Conflicts that arrive after part of the draft was detached and later restored',
    'Mixed form updates where some fields migrate and others stay put',
  ],
  steps: [
    {
      id: 'filled-draft',
      title: 'Step 1: Filled draft',
      description: 'Both panes start with your entered values.',
      view: initialView,
    },
    {
      id: 'layout-and-suggestions',
      title: 'Step 2: New layout and suggestions',
      description: 'Layout changes. AI suggests new values. See what happens.',
      view: evolvedView,
    },
  ],
};
