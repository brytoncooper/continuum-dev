import type { Scenario } from './types';

const roomOptions = [
  { id: 'standard', label: 'Standard' },
  { id: 'suite', label: 'Suite' },
];

export const orphanRetentionScenario: Scenario = {
  id: 'orphan-retention',
  title: 'Never Lose User Input',
  subtitle: 'Removed fields become restorable detached values',
  capabilityTag: 'Detached Retention',
  steps: [
    {
      id: 'orphan-step-1',
      label: 'Step 1',
      description: 'Fill booking details before AI edits the form',
      narrativePrompt: 'Enter values that should survive removals and re-additions.',
      view: {
        viewId: 'hotel-booking',
        version: '1.0',
        nodes: [
          { id: 'guest_name', key: 'guest_name', type: 'field', label: 'Guest Name' },
          {
            id: 'room_type',
            key: 'room_type',
            type: 'select',
            label: 'Room Type',
            props: { options: roomOptions },
          },
          {
            id: 'special_requests',
            key: 'special_requests',
            type: 'textarea',
            label: 'Special Requests',
          },
          {
            id: 'loyalty_number',
            key: 'loyalty_number',
            type: 'field',
            label: 'Loyalty Number',
          },
        ],
      },
      initialState: {
        guest_name: { value: 'Taylor Mason' },
        room_type: { value: 'suite' },
        special_requests: { value: 'Late check-in near elevator' },
        loyalty_number: { value: 'LTY-2201' },
      },
    },
    {
      id: 'orphan-step-2',
      label: 'Step 2',
      description: 'AI simplifies and removes two fields',
      narrativePrompt: 'Removed values are moved into detached state instead of being lost.',
      view: {
        viewId: 'hotel-booking',
        version: '2.0',
        nodes: [
          { id: 'guest_name', key: 'guest_name', type: 'field', label: 'Guest Name' },
          {
            id: 'room_type',
            key: 'room_type',
            type: 'select',
            label: 'Room Type',
            props: { options: roomOptions },
          },
        ],
      },
    },
    {
      id: 'orphan-step-3',
      label: 'Step 3',
      description: 'AI adds loyalty number back',
      narrativePrompt: 'Matching key/type restores the removed value automatically.',
      view: {
        viewId: 'hotel-booking',
        version: '3.0',
        nodes: [
          { id: 'guest_name_v2', key: 'guest_name', type: 'field', label: 'Guest Name' },
          {
            id: 'room_type',
            key: 'room_type',
            type: 'select',
            label: 'Room Type',
            props: { options: roomOptions },
          },
          {
            id: 'loyalty_number_v2',
            key: 'loyalty_number',
            type: 'field',
            label: 'Loyalty Number',
          },
        ],
      },
    },
    {
      id: 'orphan-step-4',
      label: 'Step 4',
      description: 'AI restores all previously removed fields',
      narrativePrompt: 'Both detached values come back and the detached bucket is emptied.',
      view: {
        viewId: 'hotel-booking',
        version: '4.0',
        nodes: [
          { id: 'guest_name_v3', key: 'guest_name', type: 'field', label: 'Guest Name' },
          {
            id: 'room_type',
            key: 'room_type',
            type: 'select',
            label: 'Room Type',
            props: { options: roomOptions },
          },
          {
            id: 'loyalty_number_v3',
            key: 'loyalty_number',
            type: 'field',
            label: 'Loyalty Number',
          },
          {
            id: 'special_requests_v3',
            key: 'special_requests',
            type: 'textarea',
            label: 'Special Requests',
          },
        ],
      },
    },
  ],
};
