import type { Scenario } from './types';

const baseFields = Array.from({ length: 32 }, (_, index) => ({
  id: `question_${index + 1}`,
  key: `question_${index + 1}`,
  type: 'field',
  hash: 'field:v1',
  label: `Question ${index + 1}`,
}));

const expandedFields = Array.from({ length: 56 }, (_, index) => ({
  id: index < 16 ? `q_${index + 1}` : `question_${index + 1}`,
  key: `question_${index + 1}`,
  type: index % 7 === 0 ? 'textarea' : 'field',
  hash: index % 7 === 0 ? 'textarea:v1' : 'field:v1',
  label: `Question ${index + 1}`,
}));

export const scaleStressScenario: Scenario = {
  id: 'scale-stress',
  title: 'Scale Stress',
  subtitle: 'Run 50+ nodes to inspect render and reconciliation throughput',
  capabilityTag: 'Scale',
  steps: [
    {
      id: 'scale-step-1',
      label: 'Step 1',
      description: 'Baseline form with 32 inputs',
      narrativePrompt: 'Fill a few values, then advance to the large expansion step.',
      view: {
        viewId: 'enterprise-intake',
        version: '1.0',
        nodes: [
          {
            id: 'intake_root',
            key: 'intake_root',
            type: 'group',
            label: 'Enterprise Intake',
            children: baseFields,
          },
        ],
      },
      initialState: {
        question_1: { value: 'Large account onboarding' },
        question_2: { value: 'High priority' },
        question_10: { value: 'Ops + Finance review needed' },
      },
      outcomeHint: {
        severity: 'info',
        summary: 'This step starts with 32 nodes before expansion.',
      },
    },
    {
      id: 'scale-step-2',
      label: 'Step 2',
      description: 'AI expands to 56 inputs and renames first 16 ids',
      narrativePrompt: 'Monitor devtools counters as node count and diffs increase.',
      view: {
        viewId: 'enterprise-intake',
        version: '2.0',
        nodes: [
          {
            id: 'intake_root_v2',
            key: 'intake_root',
            type: 'group',
            label: 'Enterprise Intake Expanded',
            children: expandedFields,
          },
        ],
      },
      outcomeHint: {
        severity: 'success',
        summary: 'This step keeps values stable through 56 nodes with id renames.',
      },
    },
  ],
};
