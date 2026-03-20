import type { ViewDefinition } from '@continuum-dev/contract';
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
          type: 'field',
          dataType: 'string',
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
          content:
            'AI replaced the working draft with a generated summary view.',
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
  title:
    'When an AI update goes bad, the user should be able to get the exact last good draft back.',
  selectorLabel: 'Rewind recovery',
  problem:
    'Start with a working draft. Go to step 2, a bad update breaks it. The naive pane is stuck. Continuum can restore the last good version.',
  whyItMatters:
    'Sometimes updates go wrong. You need a way back.',
  controls: {
    inputLabel: 'Your draft',
    inputDescription:
      'Enter values, go to step 2 to break it, then restore.',
    helperText: 'Step 2 has a restore button on the Continuum side.',
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
      value:
        'This draft should survive a bad AI rewrite and come back exactly as entered.',
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
      id: 'working-draft',
      title: 'Step 1: Working draft',
      description:
        'Both panes start with your entered values.',
      view: initialView,
    },
    {
      id: 'bad-update',
      title: 'Step 2: Bad update',
      description:
        'Something goes wrong. Restore the good version.',
      view: badView,
    },
  ],
};
