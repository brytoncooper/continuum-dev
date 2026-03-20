import type { ViewDefinition } from '@continuum-dev/core';

export const VERCEL_AI_SDK_SESSION_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_session_v1';

export const initialVercelAiSdkView = {
  viewId: 'vercel-ai-sdk-demo',
  version: 'baseline',
  nodes: [
    {
      id: 'demo_request',
      type: 'group',
      label: 'Request a demo',
      children: [
        {
          id: 'full_name',
          key: 'lead.fullName',
          type: 'field',
          dataType: 'string',
          label: 'Full name',
          placeholder: 'Enter full name',
        },
        {
          id: 'work_email',
          key: 'lead.workEmail',
          type: 'field',
          dataType: 'string',
          label: 'Work email',
          placeholder: 'Enter work email',
        },
        {
          id: 'company',
          key: 'lead.company',
          type: 'field',
          dataType: 'string',
          label: 'Company',
          placeholder: 'Enter company name',
        },
        {
          id: 'team',
          key: 'lead.team',
          type: 'field',
          dataType: 'string',
          label: 'Team',
          placeholder: 'Enter team or function',
        },
        {
          id: 'use_case',
          key: 'lead.useCase',
          type: 'textarea',
          label: 'What are you building?',
          placeholder: 'Describe your AI workflow or product',
        },
      ],
    },
  ],
} satisfies ViewDefinition;
