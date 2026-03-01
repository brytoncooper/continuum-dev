import type { Scenario } from './types';

const seatOptions = [
  { id: 'window', label: 'Window' },
  { id: 'aisle', label: 'Aisle' },
  { id: 'middle', label: 'Middle' },
];

export const keyMatchingScenario: Scenario = {
  id: 'key-matching',
  title: 'AI Reorganizes Without Losing Data',
  subtitle: 'Stable keys preserve values through id and structure changes',
  capabilityTag: 'Key Matching',
  steps: [
    {
      id: 'matching-step-1',
      label: 'Step 1',
      description: 'Capture baseline flight preferences',
      narrativePrompt: 'Fill preferences that should survive structural changes.',
      view: {
        viewId: 'flight-preferences',
        version: '1.0',
        nodes: [
          {
            id: 'seat_pref',
            key: 'seat_pref',
            type: 'select',
            hash: 'select:v1',
            label: 'Seat Preference',
            props: { options: seatOptions },
          },
          {
            id: 'meal_pref',
            key: 'meal_pref',
            type: 'field',
            hash: 'input:v1',
            label: 'Meal Preference',
            placeholder: 'e.g. Vegetarian',
          },
          {
            id: 'lounge_access',
            key: 'lounge_access',
            type: 'toggle',
            hash: 'toggle:v1',
            label: 'Need Lounge Access?',
          },
        ],
      },
      initialState: {
        seat_pref: { value: 'window' },
        meal_pref: { value: 'Vegetarian' },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'Set your baseline preferences before ids are renamed.',
      },
    },
    {
      id: 'matching-step-2',
      label: 'Step 2',
      description: 'AI renames ids but preserves semantic keys',
      narrativePrompt: 'The view changes ids but keeps key continuity.',
      view: {
        viewId: 'flight-preferences',
        version: '2.0',
        nodes: [
          {
            id: 'seat_choice_node',
            key: 'seat_pref',
            type: 'select',
            hash: 'select:v1',
            label: 'Seat Preference',
            props: { options: seatOptions },
          },
          {
            id: 'meal_notes_node',
            key: 'meal_pref',
            type: 'field',
            hash: 'input:v1',
            label: 'Meal Preference',
            placeholder: 'e.g. Vegetarian',
          },
          {
            id: 'airport_lounge_action',
            key: 'lounge_access',
            type: 'toggle',
            hash: 'toggle:v1',
            label: 'Need Lounge Access?',
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'All values persisted because matching by key survived id renames.',
      },
    },
    {
      id: 'matching-step-3',
      label: 'Step 3',
      description: 'AI nests fields into groups and reorders layout',
      narrativePrompt: 'Structure changes heavily while keys remain stable.',
      view: {
        viewId: 'flight-preferences',
        version: '3.0',
        nodes: [
          {
            id: 'flight_pref_section',
            key: 'flight_pref_section',
            type: 'group',
            label: 'In-Flight Preferences',
            children: [
              {
                id: 'meal_notes_relocated',
                key: 'meal_pref',
                type: 'field',
                hash: 'input:v1',
                label: 'Meal Preference',
                placeholder: 'e.g. Vegetarian',
              },
              {
                id: 'seat_choice_relocated',
                key: 'seat_pref',
                type: 'select',
                hash: 'select:v1',
                label: 'Seat Preference',
                props: { options: seatOptions },
              },
            ],
          },
          {
            id: 'airport_pref_section',
            key: 'airport_pref_section',
            type: 'group',
            label: 'Airport Preferences',
            children: [
              {
                id: 'lounge_access_relocated',
                key: 'lounge_access',
                type: 'toggle',
                hash: 'toggle:v1',
                label: 'Need Lounge Access?',
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'The layout was completely reorganized, but stable keys retained your saved preferences.',
      },
    },
  ],
};
