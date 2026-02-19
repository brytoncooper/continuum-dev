import type { SchemaSnapshot } from '@continuum/contract';

export type AgentStep = {
  label: string;
  schema: SchemaSnapshot;
};

export const steps: AgentStep[] = [
  {
    label: 'Step 1: basic form',
    schema: {
      schemaId: 'demo',
      version: '1.0',
      components: [
        { id: 'name', key: 'name', type: 'input', hash: 'input:v1' },
        {
          id: 'subscribe',
          key: 'subscribe',
          type: 'toggle',
          hash: 'toggle:v1',
        },
      ],
    },
  },
  {
    label: 'Step 2: rename id but keep key (tests reconciliation)',
    schema: {
      schemaId: 'demo',
      version: '2.0',
      components: [
        {
          id: 'full_name',
          key: 'name',
          type: 'input',
          hash: 'input:v1',
        },
        {
          id: 'subscribe',
          key: 'subscribe',
          type: 'toggle',
          hash: 'toggle:v1',
        },
      ],
    },
  },
  {
    label: 'Step 3: schema hash change (tests migration path)',
    schema: {
      schemaId: 'demo',
      version: '3.0',
      components: [
        {
          id: 'full_name',
          key: 'name',
          type: 'input',
          hash: 'input:v2',
          migrations: [
            {
              fromHash: 'input:v1',
              toHash: 'input:v2',
              strategyId: 'name-v1-to-v2',
            },
          ],
        },
        {
          id: 'subscribe',
          key: 'subscribe',
          type: 'toggle',
          hash: 'toggle:v1',
        },
      ],
    },
  },
  {
    label: 'Step 4: type change input->select (triggers TYPE_MISMATCH)',
    schema: {
      schemaId: 'demo',
      version: '4.0',
      components: [
        {
          id: 'full_name',
          key: 'name',
          type: 'select',
          hash: 'select:v1',
        },
        {
          id: 'subscribe',
          key: 'subscribe',
          type: 'toggle',
          hash: 'toggle:v1',
        },
        {
          id: 'email',
          key: 'email',
          type: 'input',
          hash: 'input:v1',
        },
      ],
    },
  },
  {
    label: 'Step 5: remove component (triggers COMPONENT_REMOVED)',
    schema: {
      schemaId: 'demo',
      version: '5.0',
      components: [
        {
          id: 'email',
          key: 'email',
          type: 'input',
          hash: 'input:v1',
        },
      ],
    },
  },
];
