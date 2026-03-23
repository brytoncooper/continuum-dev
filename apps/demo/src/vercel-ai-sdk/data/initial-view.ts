import type { ViewDefinition } from '@continuum-dev/core';
import { financialPlanningIntegrationCatalog } from './financial-planning-catalog';

export const VERCEL_AI_SDK_SESSION_STORAGE_KEY =
  'continuum_demo_vercel_ai_sdk_session_v1';

function endpointNodeId(endpointId: string): string {
  return endpointId.replace(/\./g, '_');
}

function buildStarterNodes(): ViewDefinition['nodes'] {
  const introGroup: ViewDefinition['nodes'][number] = {
    id: 'session_intro',
    type: 'group',
    label: 'Session start',
    layout: 'vertical',
    children: [
      {
        id: 'session_intro_copy',
        type: 'presentation',
        contentType: 'text',
        content:
          'You are in the Harborline Financial Workspace demo. Describe what you want in chat; the assistant will design a form for that workflow.',
      },
    ],
  };

  const actionSections: ViewDefinition['nodes'] =
    financialPlanningIntegrationCatalog.endpoints.map((endpoint) => {
      const safe = endpointNodeId(endpoint.id);
      const method = endpoint.method.trim().toUpperCase();
      return {
        id: `action_section_${safe}`,
        type: 'group',
        label: endpoint.userAction,
        layout: 'vertical',
        children: [
          {
            id: `action_section_${safe}_description`,
            type: 'presentation',
            contentType: 'text',
            content: endpoint.description,
          },
          {
            id: `action_section_${safe}_route`,
            type: 'presentation',
            contentType: 'markdown',
            content: `**Request:** \`${method} ${endpoint.path}\``,
          },
        ],
      };
    });

  const actionsGroup: ViewDefinition['nodes'][number] = {
    id: 'available_actions',
    type: 'group',
    label: 'What you can do',
    layout: 'vertical',
    children: actionSections,
  };

  return [introGroup, actionsGroup];
}

export const initialVercelAiSdkView = {
  viewId: 'vercel-ai-sdk-demo',
  version: 'actions-overview-v5',
  nodes: buildStarterNodes(),
} satisfies ViewDefinition;
