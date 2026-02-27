import type { Scenario } from './types';

export const actionLifecycleScenario: Scenario = {
  id: 'action-lifecycle',
  title: 'Chaos Resilience',
  subtitle: 'See how Continuum behaves when AI output degrades',
  capabilityTag: 'Resilience',
  steps: [
    {
      id: 'chaos-step-1',
      label: 'Step 1',
      description: 'Start with a healthy booking confirmation form',
      narrativePrompt: 'Enter values and prepare for unstable AI updates.',
      schema: {
        schemaId: 'booking-confirmation',
        version: '1.0',
        components: [
          {
            id: 'booking_reference',
            key: 'booking_reference',
            type: 'input',
            hash: 'input:v1',
            label: 'Booking Reference',
            placeholder: 'e.g. CNM-4821',
          },
          {
            id: 'contact_phone',
            key: 'contact_phone',
            type: 'input',
            hash: 'input:v1',
            label: 'Contact Phone',
            placeholder: '+1 (555) 123-4567',
          },
          {
            id: 'notify_updates',
            key: 'notify_updates',
            type: 'toggle',
            hash: 'toggle:v1',
            label: 'Send Real-Time Updates',
          },
        ],
      },
      initialState: {
        booking_reference: { value: 'CNM-4821' },
        notify_updates: { checked: true },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'Baseline values are set before unstable schemas are introduced.',
      },
    },
    {
      id: 'chaos-step-2',
      label: 'Step 2',
      description: 'AI partially degrades output with unknown field type',
      narrativePrompt: 'One field becomes unrecognized while stable keys still carry.',
      schema: {
        schemaId: 'booking-confirmation',
        version: '2.0',
        components: [
          {
            id: 'booking_reference',
            key: 'booking_reference',
            type: 'input',
            hash: 'input:v1',
            label: 'Booking Reference',
            placeholder: 'e.g. CNM-4821',
          },
          {
            id: 'contact_phone',
            key: 'contact_phone',
            type: 'telepathy-input',
            hash: 'telepathy-input:v1',
            label: 'Contact Phone',
          },
          {
            id: 'notify_updates',
            key: 'notify_updates',
            type: 'toggle',
            hash: 'toggle:v1',
            label: 'Send Real-Time Updates',
          },
        ],
      },
      outcomeHint: {
        severity: 'warning',
        summary: 'Unknown component types are isolated while valid fields keep working.',
      },
    },
    {
      id: 'chaos-step-3',
      label: 'Step 3',
      description: 'AI sends severe hallucination with id churn and removals',
      narrativePrompt: 'Observe graceful fallback with issues and trace visibility.',
      schema: {
        schemaId: 'booking-confirmation',
        version: '3.0',
        components: [
          {
            id: 'hallucinated_booking_reference',
            key: 'booking_reference',
            type: 'input',
            hash: 'input:v1',
            label: 'Booking Reference',
            placeholder: 'e.g. CNM-4821',
          },
          {
            id: 'agent_qx_901',
            key: 'agent_qx_901',
            type: 'quantum-slider',
            hash: 'quantum-slider:v1',
            label: 'Quantum Confidence',
          },
        ],
      },
      outcomeHint: {
        severity: 'danger',
        summary: 'Continuum retains what can be matched, drops unsafe state, and surfaces diagnostic signals.',
      },
    },
  ],
};

