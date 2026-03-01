import type { ViewDefinition } from '@continuum/contract';

export type AgentStep = {
  label: string;
  description: string;
  view: ViewDefinition;
};

export const steps: AgentStep[] = [
  {
    label: 'Step 1: Personal Info',
    description: 'AI generates initial loan application form',
    view: {
      viewId: 'loan-app',
      version: '1.0',
      nodes: [
        { id: 'first_name', key: 'first_name', type: 'field', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'field', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'field', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'action', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 2: AI Refines Fields',
    description: 'AI renames first_name → given_name (key preserved, data carries)',
    view: {
      viewId: 'loan-app',
      version: '2.0',
      nodes: [
        { id: 'given_name', key: 'first_name', type: 'field', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'field', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'field', hash: 'input:v1' },
        { id: 'phone', key: 'phone', type: 'field', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'action', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 3: View Migration',
    description: 'AI changes email hash (triggers migration path)',
    view: {
      viewId: 'loan-app',
      version: '3.0',
      nodes: [
        { id: 'given_name', key: 'first_name', type: 'field', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'field', hash: 'input:v1' },
        {
          id: 'email',
          key: 'email',
          type: 'field',
          hash: 'input:v2',
          migrations: [
            { fromHash: 'input:v1', toHash: 'input:v2', strategyId: 'email-v1-to-v2' },
          ],
        },
        { id: 'phone', key: 'phone', type: 'field', hash: 'input:v1' },
        { id: 'loan_amount', key: 'loan_amount', type: 'field', hash: 'input:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'action', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 4: Type Change',
    description: 'AI converts loan_amount from field to select (TYPE_MISMATCH → data dropped)',
    view: {
      viewId: 'loan-app',
      version: '4.0',
      nodes: [
        { id: 'given_name', key: 'first_name', type: 'field', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'field', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'field', hash: 'input:v2' },
        { id: 'phone', key: 'phone', type: 'field', hash: 'input:v1' },
        { id: 'loan_amount', key: 'loan_amount', type: 'select', hash: 'select:v1' },
        { id: 'employment', key: 'employment', type: 'select', hash: 'select:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'action', hash: 'toggle:v1' },
      ],
    },
  },
  {
    label: 'Step 5: Simplify',
    description: 'AI removes phone and employment (NODE_REMOVED), final review form',
    view: {
      viewId: 'loan-app',
      version: '5.0',
      nodes: [
        { id: 'given_name', key: 'first_name', type: 'field', hash: 'input:v1' },
        { id: 'last_name', key: 'last_name', type: 'field', hash: 'input:v1' },
        { id: 'email', key: 'email', type: 'field', hash: 'input:v2' },
        { id: 'loan_amount', key: 'loan_amount', type: 'select', hash: 'select:v1' },
        { id: 'agree_terms', key: 'agree_terms', type: 'action', hash: 'toggle:v1' },
      ],
    },
  },
];
