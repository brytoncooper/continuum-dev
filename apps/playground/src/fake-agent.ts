import type { SchemaSnapshot } from '@continuum/contract';

export type AgentStep = {
  label: string;
  description: string;
  schema: SchemaSnapshot;
};

export const steps: AgentStep[] = [
  {
    label: 'Step 1: Personal Info',
    description: 'AI generates initial loan application form',
    schema: {
      schemaId: 'loan-app',
      version: '1.0',
      components: [
        { id: 'first_name', key: 'first_name', type: 'input', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'input', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'input', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'toggle', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 2: AI Refines Fields',
    description: 'AI renames first_name → given_name (key preserved, state carries)',
    schema: {
      schemaId: 'loan-app',
      version: '2.0',
      components: [
        { id: 'given_name', key: 'first_name', type: 'input', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'input', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'input', hash: 'input:v1' },
        { id: 'phone', key: 'phone', type: 'input', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'toggle', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 3: Schema Migration',
    description: 'AI changes email hash (triggers migration path)',
    schema: {
      schemaId: 'loan-app',
      version: '3.0',
      components: [
        { id: 'given_name', key: 'first_name', type: 'input', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'input', hash: 'input:v1' },
        {
          id: 'email',
          key: 'email',
          type: 'input',
          hash: 'input:v2',
          migrations: [
            { fromHash: 'input:v1', toHash: 'input:v2', strategyId: 'email-v1-to-v2' },
          ],
        },
        { id: 'phone', key: 'phone', type: 'input', hash: 'input:v1' },
        { id: 'loan_amount', key: 'loan_amount', type: 'input', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'toggle', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 4: Type Change',
    description: 'AI converts loan_amount from input to select (TYPE_MISMATCH → state dropped)',
    schema: {
      schemaId: 'loan-app',
      version: '4.0',
      components: [
        { id: 'given_name', key: 'first_name', type: 'input', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'input', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'input', hash: 'input:v2' },
        { id: 'phone', key: 'phone', type: 'input', hash: 'input:v1' },
        { id: 'loan_amount', key: 'loan_amount', type: 'select', hash: 'select:v1' },
        { id: 'employment', key: 'employment', type: 'select', hash: 'select:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'toggle', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 5: Simplify',
    description: 'AI removes phone and employment (COMPONENT_REMOVED), final review form',
    schema: {
      schemaId: 'loan-app',
      version: '5.0',
      components: [
        { id: 'given_name', key: 'first_name', type: 'input', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'input', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'input', hash: 'input:v2' },
        { id: 'loan_amount', key: 'loan_amount', type: 'select', hash: 'select:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'toggle', hash: 'toggle:v1' },
      ],
    },
  },
];
