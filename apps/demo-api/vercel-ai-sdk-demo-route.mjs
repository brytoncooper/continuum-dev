import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import {
  VERCEL_AI_SDK_DEMO_PATH,
  extractLatestUserInstruction,
  isVercelAiSdkDemoPath,
  methodNotAllowed,
} from './vercel-ai-sdk-shared.mjs';

export { isVercelAiSdkDemoPath };

export { VERCEL_AI_SDK_DEMO_PATH };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBaseView() {
  return {
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
  };
}

function buildMobileView() {
  return {
    viewId: 'vercel-ai-sdk-demo',
    version: 'mobile',
    nodes: [
      {
        id: 'priority_intro',
        type: 'presentation',
        contentType: 'text',
        content:
          'Mobile-first pass: the most important questions come first, but the underlying semantic keys stay stable.',
      },
      {
        id: 'priority_group',
        type: 'group',
        key: 'priority',
        label: 'Start here',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
            label: 'Full name',
          },
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            label: 'Email',
          },
          {
            id: 'goal',
            type: 'field',
            dataType: 'string',
            key: 'request.goal',
            label: 'Main goal',
          },
        ],
      },
      {
        id: 'details_group',
        type: 'group',
        key: 'details',
        label: 'Additional details',
        children: [
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            key: 'person.phone',
            label: 'Phone',
          },
          {
            id: 'timeline',
            type: 'field',
            dataType: 'string',
            key: 'request.timeline',
            label: 'Timeline',
          },
        ],
      },
    ],
  };
}

function buildHouseholdView() {
  return {
    viewId: 'vercel-ai-sdk-demo',
    version: 'household',
    nodes: [
      {
        id: 'profile',
        type: 'group',
        key: 'profile',
        label: 'Primary contact',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
            label: 'Full name',
          },
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            label: 'Email',
          },
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            key: 'person.phone',
            label: 'Phone',
          },
        ],
      },
      {
        id: 'household_members',
        type: 'collection',
        key: 'household.members',
        label: 'Household members',
        minItems: 1,
        template: {
          id: 'member',
          type: 'group',
          key: 'member',
          label: 'Member',
          children: [
            {
              id: 'member_name',
              type: 'field',
              dataType: 'string',
              key: 'member.name',
              label: 'Name',
            },
            {
              id: 'member_relationship',
              type: 'field',
              dataType: 'string',
              key: 'member.relationship',
              label: 'Relationship',
            },
            {
              id: 'member_birth_date',
              type: 'field',
              dataType: 'string',
              key: 'member.birthDate',
              label: 'Birth date',
            },
          ],
        },
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
          },
          {
            id: 'timeline',
            type: 'field',
            dataType: 'string',
            key: 'request.timeline',
            label: 'Timeline',
          },
        ],
      },
    ],
  };
}

function buildBusinessLeadView() {
  return {
    viewId: 'vercel-ai-sdk-demo',
    version: 'business-lead',
    nodes: [
      {
        id: 'company_profile',
        type: 'group',
        key: 'company_profile',
        label: 'Primary contact',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
            label: 'Contact name',
          },
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            label: 'Work email',
          },
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            key: 'person.phone',
            label: 'Phone',
          },
          {
            id: 'company',
            type: 'field',
            dataType: 'string',
            key: 'company.name',
            label: 'Company',
          },
        ],
      },
      {
        id: 'opportunity',
        type: 'group',
        key: 'opportunity',
        label: 'Opportunity details',
        children: [
          {
            id: 'goal',
            type: 'field',
            dataType: 'string',
            key: 'request.goal',
            label: 'Project scope',
          },
          {
            id: 'budget',
            type: 'field',
            dataType: 'string',
            key: 'request.budget',
            label: 'Budget range',
          },
          {
            id: 'timeline',
            type: 'field',
            dataType: 'string',
            key: 'request.timeline',
            label: 'Decision timeline',
          },
        ],
      },
    ],
  };
}

function buildMedicalView() {
  return {
    viewId: 'vercel-ai-sdk-demo',
    version: 'medical',
    nodes: [
      {
        id: 'patient',
        type: 'group',
        key: 'patient',
        label: 'Patient details',
        children: [
          {
            id: 'full_name',
            type: 'field',
            dataType: 'string',
            key: 'person.fullName',
            label: 'Patient name',
          },
          {
            id: 'email',
            type: 'field',
            dataType: 'string',
            key: 'person.email',
            label: 'Email',
          },
          {
            id: 'phone',
            type: 'field',
            dataType: 'string',
            key: 'person.phone',
            label: 'Phone',
          },
          {
            id: 'insurance',
            type: 'field',
            dataType: 'string',
            key: 'patient.insurance',
            label: 'Insurance provider',
          },
        ],
      },
      {
        id: 'visit_reason',
        type: 'group',
        key: 'visit_reason',
        label: 'Visit details',
        children: [
          {
            id: 'goal',
            type: 'field',
            dataType: 'string',
            key: 'request.goal',
            label: 'Reason for visit',
          },
          {
            id: 'medications',
            type: 'field',
            dataType: 'string',
            key: 'patient.medications',
            label: 'Current medications',
          },
          {
            id: 'allergies',
            type: 'field',
            dataType: 'string',
            key: 'patient.allergies',
            label: 'Allergies',
          },
          {
            id: 'timeline',
            type: 'field',
            dataType: 'string',
            key: 'request.timeline',
            label: 'When did this start?',
          },
        ],
      },
    ],
  };
}

function selectDemoView(instruction) {
  const prompt = instruction.toLowerCase();

  if (
    prompt.includes('urgent care') ||
    prompt.includes('patient') ||
    prompt.includes('insurance') ||
    prompt.includes('medication')
  ) {
    return {
      label: 'urgent care intake',
      view: buildMedicalView(),
    };
  }

  if (
    prompt.includes('business') ||
    prompt.includes('lead') ||
    prompt.includes('company') ||
    prompt.includes('budget')
  ) {
    return {
      label: 'business lead',
      view: buildBusinessLeadView(),
    };
  }

  if (
    prompt.includes('household') ||
    prompt.includes('member') ||
    prompt.includes('family')
  ) {
    return {
      label: 'household collection',
      view: buildHouseholdView(),
    };
  }

  if (
    prompt.includes('mobile') ||
    prompt.includes('phone first') ||
    prompt.includes('less crowded')
  ) {
    return {
      label: 'mobile-first',
      view: buildMobileView(),
    };
  }

  return {
    label: 'baseline',
    view: buildBaseView(),
  };
}

export async function handleVercelAiSdkDemoRequest(request) {
  if (request.method !== 'POST') {
    return methodNotAllowed('POST');
  }

  const body = await request.json().catch(() => ({}));
  const instruction = extractLatestUserInstruction(body?.messages);
  const selection = selectDemoView(instruction);
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: 'data-continuum-status',
        data: {
          status: 'Reading the prompt and planning the next Continuum view...',
          level: 'info',
        },
        transient: true,
      });
      await delay(120);
      writer.write({
        type: 'data-continuum-status',
        data: {
          status: `Streaming ${selection.label} view updates into the active session...`,
          level: 'info',
        },
        transient: true,
      });
      await delay(140);
      writer.write({
        type: 'data-continuum-view',
        data: {
          view: selection.view,
        },
      });
      writer.write({
        type: 'data-continuum-status',
        data: {
          status: `Applied ${selection.label} demo view. Try another prompt and keep typing while the structure changes.`,
          level: 'success',
        },
      });
    },
  });

  return createUIMessageStreamResponse({
    stream,
  });
}
