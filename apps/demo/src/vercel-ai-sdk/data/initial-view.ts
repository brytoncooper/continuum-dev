import type { ViewDefinition } from '@continuum-dev/core';

export const VERCEL_AI_SDK_SESSION_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_session_v1';

export const initialVercelAiSdkView = {
  viewId: 'vercel-ai-sdk-demo',
  version: 'baseline',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      key: 'profile',
      label: 'Contact profile',
      children: [
        {
          id: 'full_name',
          type: 'field',
          dataType: 'string',
          key: 'person.fullName',
          label: 'Full name',
          placeholder: 'Jordan Lee',
        },
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'person.email',
          label: 'Email',
          placeholder: 'jordan@example.com',
        },
        {
          id: 'phone',
          type: 'field',
          dataType: 'string',
          key: 'person.phone',
          label: 'Phone',
          placeholder: '(555) 555-5555',
        },
      ],
    },
    {
      id: 'request',
      type: 'group',
      key: 'request',
      label: 'What they need',
      children: [
        {
          id: 'goal',
          type: 'field',
          dataType: 'string',
          key: 'request.goal',
          label: 'Goal',
          placeholder: 'Describe what you need help with.',
        },
        {
          id: 'timeline',
          type: 'field',
          dataType: 'string',
          key: 'request.timeline',
          label: 'Timeline',
          placeholder: 'This month',
        },
      ],
    },
  ],
} satisfies ViewDefinition;
