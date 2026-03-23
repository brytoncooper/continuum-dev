import type { ActionHandler } from '@continuum-dev/protocol';

const demoActionHandler: ActionHandler = async () => ({ success: true });

export const financialPlanningSessionActions = {
  'client.profile.save': {
    registration: {
      label: 'Save profile',
      description: 'Persist household and contact fields for PUT /api/v1/clients/me/profile.',
    },
    handler: demoActionHandler,
  },
  'goals.retirement.save': {
    registration: {
      label: 'Save retirement goal',
      description: 'Persist retirement goal snapshot for POST /api/v1/goals/retirement.',
    },
    handler: demoActionHandler,
  },
  'cashflow.monthly.save': {
    registration: {
      label: 'Save monthly cashflow',
      description: 'Persist income and expense snapshot for POST /api/v1/cashflow/monthly.',
    },
    handler: demoActionHandler,
  },
  'risk.profile.save': {
    registration: {
      label: 'Save risk assessment',
      description: 'Persist risk tolerance for POST /api/v1/risk-assessments.',
    },
    handler: demoActionHandler,
  },
  'documents.metadata.save': {
    registration: {
      label: 'Register document',
      description: 'Persist document metadata for POST /api/v1/documents/metadata.',
    },
    handler: demoActionHandler,
  },
} as const;
