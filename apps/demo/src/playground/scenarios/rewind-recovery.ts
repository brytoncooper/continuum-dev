import type { ViewDefinition } from '@continuum/contract';
import type { PlaygroundRecoveryScenario } from '../types';

const initialView: ViewDefinition = {
  viewId: 'playground-rewind-recovery',
  version: '1',
  nodes: [
    {
      id: 'recovery_profile',
      type: 'group',
      label: 'Draft profile',
      children: [
        {
          id: 'recovery_name',
          key: 'profile.name',
          type: 'field',
          dataType: 'string',
          label: 'Name',
          placeholder: 'Enter Name',
        },
        {
          id: 'recovery_title',
          key: 'profile.title',
          type: 'field',
          dataType: 'string',
          label: 'Title',
          placeholder: 'Enter Title',
        },
        {
          id: 'recovery_notes',
          key: 'profile.notes',
          type: 'textarea',
          label: 'Notes',
          placeholder: 'Enter Notes',
        },
      ],
    },
  ],
};

const badView: ViewDefinition = {
  viewId: 'playground-rewind-recovery',
  version: '2',
  nodes: [
    {
      id: 'bad_summary',
      type: 'group',
      label: 'Generated summary',
      children: [
        {
          id: 'bad_pitch',
          type: 'presentation',
          contentType: 'text',
          content: 'AI replaced the working draft with a generated summary view.',
        },
        {
          id: 'recovery_summary',
          key: 'profile.summary',
          type: 'field',
          dataType: 'string',
          label: 'Summary',
          placeholder: 'Enter Summary',
        },
      ],
    },
  ],
};

export const rewindRecoveryScenario: PlaygroundRecoveryScenario = {
  id: 'rewind-recovery',
  kind: 'rewind-recovery',
  title: 'When an AI update goes bad, the user should be able to get the exact last good draft back.',
  selectorLabel: 'Rewind recovery',
  problem:
    'The user already has a working draft. Then a deterministic AI update replaces that form with the wrong screen. Without checkpoints, the user can only look at a broken rewrite. With Continuum, the session can rewind to the exact prior draft state.',
  whyItMatters:
    'Preserving data during a good update is only half the story. Real systems also need a way to recover from a bad one. Rewind turns the last good state into something the user can actually return to.',
  controls: {
    inputLabel: 'Starting form values',
    inputDescription:
      'Edit the working draft here, then advance to the bad update and use the snapshot tool to restore the last good state.',
    helperText: '',
  },
  trackedFields: [
    { key: 'profile.name', label: 'Name' },
    { key: 'profile.title', label: 'Title' },
    { key: 'profile.notes', label: 'Notes' },
  ],
  initialValues: {
    'profile.name': { value: 'Bryton Cooper', isDirty: true },
    'profile.title': { value: 'Founder', isDirty: true },
    'profile.notes': {
      value: 'This draft should survive a bad AI rewrite and come back exactly as entered.',
      isDirty: true,
    },
  },
  nextProblems: [
    'Checkpoint recovery after proposals and detached values are both present',
    'Recovering the last good draft after multiple bad pushes in a row',
    'Session resume across reload plus rewind to an older checkpoint',
  ],
  steps: [
    {
      id: 'recovery-start',
      title: 'Step 1: The user has a working draft',
      description: 'Both panes begin with the same filled-in draft before anything goes wrong.',
      view: initialView,
    },
    {
      id: 'recovery-bad-update',
      title: 'Step 2: A bad AI update replaces the working form',
      description:
        'The next deterministic view throws away the draft form and replaces it with the wrong generated screen. The Continuum side then exposes the saved snapshot tool so the user can restore the draft directly.',
      view: badView,
    },
  ],
};
