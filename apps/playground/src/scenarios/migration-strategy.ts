import type { Scenario } from './types';

export const migrationStrategyScenario: Scenario = {
  id: 'migration-strategy',
  title: 'AI Upgrades Field Formats',
  subtitle: 'Continuum migrates values when schema hashes evolve',
  capabilityTag: 'Migration',
  steps: [
    {
      id: 'migration-step-1',
      label: 'Step 1',
      description: 'Start with baseline traveler profile fields',
      narrativePrompt: 'Enter contact details that should survive format upgrades.',
      schema: {
        schemaId: 'traveler-profile',
        version: '1.0',
        components: [
          {
            id: 'full_name',
            key: 'full_name',
            type: 'input',
            hash: 'input:v1',
            label: 'Full Name',
            placeholder: 'e.g. Sam Rivera',
            constraints: { required: true, minLength: 2 },
          },
          {
            id: 'contact_email',
            key: 'contact_email',
            type: 'input',
            hash: 'input:v1',
            label: 'Email Address',
            placeholder: 'sam@email.com',
            constraints: { required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          },
          {
            id: 'passport_expiry',
            key: 'passport_expiry',
            type: 'date',
            hash: 'date:v1',
            label: 'Passport Expiration Date',
          },
        ],
      },
      initialState: {
        full_name: { value: 'Sam Rivera' },
        contact_email: { value: 'sam@email.com' },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'Baseline values are set before migration rules are introduced.',
      },
    },
    {
      id: 'migration-step-2',
      label: 'Step 2',
      description: 'AI upgrades email validation and formatting logic',
      narrativePrompt: 'The email component hash changes from v1 to v2.',
      schema: {
        schemaId: 'traveler-profile',
        version: '2.0',
        components: [
          {
            id: 'full_name',
            key: 'full_name',
            type: 'input',
            hash: 'input:v1',
            label: 'Full Name',
            placeholder: 'e.g. Sam Rivera',
            constraints: { required: true, minLength: 2 },
          },
          {
            id: 'contact_email',
            key: 'contact_email',
            type: 'input',
            hash: 'input:v2',
            label: 'Email Address',
            placeholder: 'sam@email.com',
            constraints: { required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
            migrations: [
              {
                fromHash: 'input:v1',
                toHash: 'input:v2',
                strategyId: 'email-v1-to-v2',
              },
            ],
          },
          {
            id: 'passport_expiry',
            key: 'passport_expiry',
            type: 'date',
            hash: 'date:v1',
            label: 'Passport Expiration Date',
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'Email survived hash upgrade and was migrated instead of dropped.',
      },
    },
    {
      id: 'migration-step-3',
      label: 'Step 3',
      description: 'AI changes date field hash for new formatter',
      narrativePrompt: 'Passport date component upgrades while preserving existing value.',
      schema: {
        schemaId: 'traveler-profile',
        version: '3.0',
        components: [
          {
            id: 'full_name',
            key: 'full_name',
            type: 'input',
            hash: 'input:v1',
            label: 'Full Name',
            placeholder: 'e.g. Sam Rivera',
            constraints: { required: true, minLength: 2 },
          },
          {
            id: 'contact_email',
            key: 'contact_email',
            type: 'input',
            hash: 'input:v2',
            label: 'Email Address',
            placeholder: 'sam@email.com',
            constraints: { required: true, pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          },
          {
            id: 'passport_expiry',
            key: 'passport_expiry',
            type: 'date',
            hash: 'date:v2',
            label: 'Passport Expiration Date',
            migrations: [
              {
                fromHash: 'date:v1',
                toHash: 'date:v2',
                strategyId: 'date-v1-to-v2',
              },
            ],
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'Date formatting changed internally, but your saved passport date remained available.',
      },
    },
  ],
};

