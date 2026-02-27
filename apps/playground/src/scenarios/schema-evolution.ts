import type { Scenario } from './types';

const budgetOptions = [
  { id: 'budget', label: 'Budget ($500-1,000)' },
  { id: 'mid', label: 'Mid-range ($1,000-3,000)' },
  { id: 'luxury', label: 'Luxury ($3,000+)' },
];

const styleOptions = [
  { id: 'adventure', label: 'Adventure' },
  { id: 'relaxation', label: 'Relaxation' },
  { id: 'cultural', label: 'Cultural Immersion' },
  { id: 'foodie', label: 'Food & Dining' },
];

export const schemaEvolutionScenario: Scenario = {
  id: 'schema-evolution',
  title: 'AI Refines Your Trip',
  subtitle: 'Watch your travel preferences survive schema evolution',
  capabilityTag: 'Schema Evolution',
  steps: [
    {
      id: 'trip-step-1',
      label: 'Step 1',
      description: 'Tell the AI where you want to go',
      narrativePrompt: 'Start with your core trip details.',
      schema: {
        schemaId: 'trip-planner',
        version: '1.0',
        components: [
          {
            id: 'destination',
            key: 'destination',
            type: 'input',
            hash: 'input:v1',
            label: 'Destination',
            placeholder: 'e.g. Tokyo, Japan',
          },
          {
            id: 'travel_date',
            key: 'travel_date',
            type: 'date',
            hash: 'date:v1',
            label: 'When do you want to travel?',
          },
          {
            id: 'travelers',
            key: 'travelers',
            type: 'slider',
            hash: 'slider:v1',
            label: 'How many travelers?',
            defaultValue: { value: 1 },
            props: { min: 1, max: 20 },
          },
          {
            id: 'trip_notes',
            key: 'trip_notes',
            type: 'textarea',
            hash: 'textarea:v1',
            label: 'Anything else the AI should know?',
            placeholder: 'Dietary needs, accessibility, neighborhoods, activities',
          },
        ],
      },
      initialState: {
        destination: { value: 'Tokyo, Japan' },
        travelers: { value: 2 },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'This baseline captures what matters to your trip so it can survive future AI edits.',
      },
    },
    {
      id: 'trip-step-2',
      label: 'Step 2',
      description: 'AI personalizes your itinerary fields',
      narrativePrompt: 'The AI renames and expands fields while preserving values by key.',
      schema: {
        schemaId: 'trip-planner',
        version: '2.0',
        components: [
          {
            id: 'primary_destination',
            key: 'destination',
            type: 'input',
            hash: 'input:v1',
            label: 'Primary Destination',
            placeholder: 'e.g. Tokyo, Japan',
          },
          {
            id: 'travel_date',
            key: 'travel_date',
            type: 'date',
            hash: 'date:v1',
            label: 'When do you want to travel?',
          },
          {
            id: 'travelers',
            key: 'travelers',
            type: 'slider',
            hash: 'slider:v1',
            label: 'How many travelers?',
            props: { min: 1, max: 20 },
          },
          {
            id: 'budget',
            key: 'budget',
            type: 'select',
            hash: 'select:v1',
            label: 'Budget Range',
            defaultValue: { selectedIds: ['mid'] },
            props: { options: budgetOptions },
          },
          {
            id: 'travel_style',
            key: 'travel_style',
            type: 'radio-group',
            hash: 'radio:v1',
            label: 'Travel Style',
            props: { options: styleOptions },
          },
          {
            id: 'trip_notes',
            key: 'trip_notes',
            type: 'textarea',
            hash: 'textarea:v1',
            label: 'Anything else the AI should know?',
            placeholder: 'Dietary needs, accessibility, neighborhoods, activities',
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'Your destination carried over even after the AI renamed the component id.',
      },
    },
    {
      id: 'trip-step-3',
      label: 'Step 3',
      description: 'AI restructures the trip form into sections',
      narrativePrompt: 'The layout changes heavily and budget changes type.',
      schema: {
        schemaId: 'trip-planner',
        version: '3.0',
        components: [
          {
            id: 'trip_details_section',
            key: 'trip_details_section',
            type: 'section',
            label: 'Trip Details',
            children: [
              {
                id: 'destination_input',
                key: 'destination',
                type: 'input',
                hash: 'input:v1',
                label: 'Destination',
                placeholder: 'e.g. Tokyo, Japan',
              },
              {
                id: 'travel_date',
                key: 'travel_date',
                type: 'date',
                hash: 'date:v1',
                label: 'Travel Date',
              },
              {
                id: 'travelers',
                key: 'travelers',
                type: 'slider',
                hash: 'slider:v1',
                label: 'Travelers',
                props: { min: 1, max: 20 },
              },
            ],
          },
          {
            id: 'preferences_section',
            key: 'preferences_section',
            type: 'section',
            label: 'Preferences',
            children: [
              {
                id: 'budget',
                key: 'budget',
                type: 'slider',
                hash: 'slider:v2',
                label: 'Budget Preference',
                props: { min: 0, max: 100 },
              },
              {
                id: 'travel_style',
                key: 'travel_style',
                type: 'radio-group',
                hash: 'radio:v1',
                label: 'Travel Style',
                props: { options: styleOptions },
              },
              {
                id: 'trip_notes',
                key: 'trip_notes',
                type: 'textarea',
                hash: 'textarea:v1',
                label: 'Notes',
                placeholder: 'What should the AI optimize for?',
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'warning',
        summary: 'Budget was reset because it changed from dropdown to slider, but the rest of your trip data stayed intact.',
      },
    },
    {
      id: 'trip-step-4',
      label: 'Step 4',
      description: 'AI simplifies the form for final booking',
      narrativePrompt: 'Non-essential fields are removed while core details remain.',
      schema: {
        schemaId: 'trip-planner',
        version: '4.0',
        components: [
          {
            id: 'final_trip_section',
            key: 'final_trip_section',
            type: 'section',
            label: 'Final Booking Details',
            children: [
              {
                id: 'destination_final',
                key: 'destination',
                type: 'input',
                hash: 'input:v1',
                label: 'Destination',
                placeholder: 'e.g. Tokyo, Japan',
              },
              {
                id: 'travel_date',
                key: 'travel_date',
                type: 'date',
                hash: 'date:v1',
                label: 'Travel Date',
              },
              {
                id: 'travelers',
                key: 'travelers',
                type: 'slider',
                hash: 'slider:v1',
                label: 'Travelers',
                props: { min: 1, max: 20 },
              },
              {
                id: 'budget',
                key: 'budget',
                type: 'slider',
                hash: 'slider:v2',
                label: 'Budget Preference',
                props: { min: 0, max: 100 },
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'warning',
        summary: 'The AI removed non-essential preferences, but your final booking details were preserved.',
      },
    },
  ],
};

