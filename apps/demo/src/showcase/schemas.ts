import type { CollectionNodeState, NodeValue, ViewDefinition, ViewNode } from '@continuum/contract';

export interface DemoExample {
  title: string;
  description: string;
  span?: 4 | 6 | 12;
  view: ViewDefinition;
  initialValues?: Record<string, NodeValue>;
}

export interface DemoSection {
  title: string;
  description: string;
  examples: DemoExample[];
}

function node(definition: Record<string, unknown>): ViewNode {
  return definition as unknown as ViewNode;
}

function collectionValue(items: Array<{ values: Record<string, NodeValue> }>): NodeValue<CollectionNodeState> {
  return {
    value: {
      items,
    },
  };
}

export const demoSections: DemoSection[] = [
  {
    title: 'Primitive gallery',
    description:
      'Each primitive sits in the same quiet system so you can judge height, spacing, and overall composability without extra product chrome.',
    examples: [
      {
        title: 'Text field',
        description: 'Default single-line text input with the shared control height.',
        span: 4,
        view: {
          viewId: 'demo-field-text',
          version: '1',
          nodes: [{ id: 'full_name', type: 'field', dataType: 'string', label: 'Full name', placeholder: 'Enter Name' }],
        },
        initialValues: {
          full_name: { value: 'Ada Lovelace' },
        },
      },
      {
        title: 'Number field',
        description: 'Numeric entry uses the same frame and spacing as text.',
        span: 4,
        view: {
          viewId: 'demo-field-number',
          version: '1',
          nodes: [{ id: 'budget', type: 'field', dataType: 'number', label: 'Budget', placeholder: 'Enter Amount' }],
        },
        initialValues: {
          budget: { value: 1200 },
        },
      },
      {
        title: 'Select',
        description: 'Single-choice dropdown sized to match the other controls.',
        span: 4,
        view: {
          viewId: 'demo-select',
          version: '1',
          nodes: [
            node({
              id: 'travel_style',
              type: 'select',
              label: 'Travel style',
              options: [
                { value: 'quiet', label: 'Quiet' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'active', label: 'Active' },
              ],
            }),
          ],
        },
        initialValues: {
          travel_style: { value: 'balanced' },
        },
      },
      {
        title: 'Toggle',
        description: 'Binary control tuned to align cleanly with form labels.',
        span: 4,
        view: {
          viewId: 'demo-toggle',
          version: '1',
          nodes: [node({ id: 'notifications', type: 'toggle', label: 'Email updates', description: 'Weekly summary only' })],
        },
        initialValues: {
          notifications: { value: true },
        },
      },
      {
        title: 'Date',
        description: 'Date input keeps the same control rhythm as the text field.',
        span: 4,
        view: {
          viewId: 'demo-date',
          version: '1',
          nodes: [node({ id: 'start_date', type: 'date', label: 'Start date' })],
        },
        initialValues: {
          start_date: { value: '2026-04-18' },
        },
      },
      {
        title: 'Textarea',
        description: 'Multi-line input expands vertically while staying visually related to the one-line primitives.',
        span: 4,
        view: {
          viewId: 'demo-textarea',
          version: '1',
          nodes: [node({ id: 'notes', type: 'textarea', label: 'Notes', placeholder: 'Enter Notes' })],
        },
        initialValues: {
          notes: { value: 'Focus on clarity, hierarchy, and a neutral visual tone.' },
        },
      },
      {
        title: 'Radio group',
        description: 'Single-choice options with a quiet stacked treatment.',
        span: 6,
        view: {
          viewId: 'demo-radio',
          version: '1',
          nodes: [
            node({
              id: 'delivery_mode',
              type: 'radio-group',
              label: 'Delivery mode',
              options: [
                { value: 'onsite', label: 'On-site' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'remote', label: 'Remote' },
              ],
            }),
          ],
        },
        initialValues: {
          delivery_mode: { value: 'hybrid' },
        },
      },
      {
        title: 'Slider',
        description: 'Numeric range control with matching label rhythm and control spacing.',
        span: 6,
        view: {
          viewId: 'demo-slider',
          version: '1',
          nodes: [node({ id: 'confidence', type: 'slider', label: 'Confidence', min: 0, max: 10 })],
        },
        initialValues: {
          confidence: { value: 7 },
        },
      },
      {
        title: 'Action',
        description: 'Primary action treatment kept direct and restrained.',
        span: 6,
        view: {
          viewId: 'demo-action',
          version: '1',
          nodes: [{ id: 'submit_demo', type: 'action', intentId: 'demo.submit', label: 'Submit sample' }],
        },
      },
      {
        title: 'Presentation',
        description: 'Read-only content lives in the same spacing system without looking decorative.',
        span: 6,
        view: {
          viewId: 'demo-presentation',
          version: '1',
          nodes: [
            {
              id: 'intro_copy',
              type: 'presentation',
              contentType: 'text',
              content:
                'A polished schema-driven UI should feel structured and trustworthy before any product-specific styling is layered on top.',
            },
          ],
        },
      },
    ],
  },
  {
    title: 'Container primitives',
    description:
      'These examples show how the basic container types hold together without falling back to repeated bordered boxes at every level.',
    examples: [
      {
        title: 'Group',
        description: 'Section-based grouping with quiet headings and balanced spacing.',
        span: 6,
        view: {
          viewId: 'demo-group',
          version: '1',
          nodes: [
            {
              id: 'profile_group',
              type: 'group',
              label: 'Profile',
              children: [
                { id: 'first_name', type: 'field', dataType: 'string', label: 'First name' },
                { id: 'last_name', type: 'field', dataType: 'string', label: 'Last name' },
                node({
                  id: 'role',
                  type: 'select',
                  label: 'Role',
                  options: [
                    { value: 'designer', label: 'Designer' },
                    { value: 'engineer', label: 'Engineer' },
                    { value: 'ops', label: 'Operations' },
                  ],
                }),
              ],
            },
          ],
        },
        initialValues: {
          'profile_group/first_name': { value: 'Jordan' },
          'profile_group/last_name': { value: 'Lee' },
          'profile_group/role': { value: 'designer' },
        },
      },
      {
        title: 'Row',
        description: 'Horizontal layout stays tight and aligned even with mixed primitive types.',
        span: 6,
        view: {
          viewId: 'demo-row',
          version: '1',
          nodes: [
            {
              id: 'travel_row',
              type: 'row',
              children: [
                { id: 'destination', type: 'field', dataType: 'string', label: 'Destination' },
                node({ id: 'departure', type: 'date', label: 'Departure' }),
                { id: 'book_now', type: 'action', intentId: 'demo.submit', label: 'Book' },
              ],
            },
          ],
        },
        initialValues: {
          'travel_row/destination': { value: 'Copenhagen' },
          'travel_row/departure': { value: '2026-05-01' },
        },
      },
      {
        title: 'Grid',
        description: 'Structured multi-column grouping for broader forms.',
        span: 12,
        view: {
          viewId: 'demo-grid',
          version: '1',
          nodes: [
            {
              id: 'grid_profile',
              type: 'grid',
              columns: 2,
              children: [
                { id: 'company', type: 'field', dataType: 'string', label: 'Company' },
                node({ id: 'renewal_date', type: 'date', label: 'Renewal date' }),
                node({
                  id: 'plan',
                  type: 'radio-group',
                  label: 'Plan',
                  options: [
                    { value: 'core', label: 'Core' },
                    { value: 'growth', label: 'Growth' },
                    { value: 'custom', label: 'Custom' },
                  ],
                }),
                node({ id: 'adoption', type: 'slider', label: 'Adoption', min: 0, max: 100 }),
              ],
            },
          ],
        },
        initialValues: {
          'grid_profile/company': { value: 'Northline Studio' },
          'grid_profile/renewal_date': { value: '2026-06-12' },
          'grid_profile/plan': { value: 'growth' },
          'grid_profile/adoption': { value: 68 },
        },
      },
      {
        title: 'Collection',
        description: 'Repeatable sections rely on consistent item rhythm instead of heavy card stacking.',
        span: 12,
        view: {
          viewId: 'demo-collection',
          version: '1',
          nodes: [
            {
              id: 'team_members',
              type: 'collection',
              label: 'Team members',
              minItems: 1,
              template: {
                id: 'team_member',
                type: 'group',
                label: 'Member',
                children: [
                  { id: 'member_name', type: 'field', dataType: 'string', label: 'Name' },
                  node({
                    id: 'member_role',
                    type: 'select',
                    label: 'Role',
                    options: [
                      { value: 'lead', label: 'Lead' },
                      { value: 'design', label: 'Design' },
                      { value: 'engineering', label: 'Engineering' },
                    ],
                  }),
                  node({ id: 'member_active', type: 'toggle', label: 'Active' }),
                ],
              },
            },
          ],
        },
        initialValues: {
          team_members: collectionValue([
            {
              values: {
                'team_member/member_name': { value: 'Mina Patel' },
                'team_member/member_role': { value: 'lead' },
                'team_member/member_active': { value: true },
              },
            },
            {
              values: {
                'team_member/member_name': { value: 'Chris Wong' },
                'team_member/member_role': { value: 'engineering' },
                'team_member/member_active': { value: true },
              },
            },
          ]),
        },
      },
      {
        title: 'Collection rows',
        description: 'A row-based collection showing the add-row flow and the inline square remove action.',
        span: 12,
        view: {
          viewId: 'demo-collection-rows',
          version: '1',
          nodes: [
            {
              id: 'line_items',
              type: 'collection',
              label: 'Line items',
              minItems: 1,
              template: {
                id: 'line_item',
                type: 'row',
                children: [
                  { id: 'item_name', type: 'field', dataType: 'string', label: 'Item' },
                  { id: 'quantity', type: 'field', dataType: 'number', label: 'Qty' },
                  node({
                    id: 'status',
                    type: 'select',
                    label: 'Status',
                    options: [
                      { value: 'draft', label: 'Draft' },
                      { value: 'ready', label: 'Ready' },
                      { value: 'shipped', label: 'Shipped' },
                    ],
                  }),
                  node({ id: 'needed_by', type: 'date', label: 'Needed by' }),
                ],
              },
            },
          ],
        },
        initialValues: {
          line_items: collectionValue([
            {
              values: {
                'line_item/item_name': { value: 'Travel pack' },
                'line_item/quantity': { value: 12 },
                'line_item/status': { value: 'ready' },
                'line_item/needed_by': { value: '2026-05-12' },
              },
            },
            {
              values: {
                'line_item/item_name': { value: 'Demo cards' },
                'line_item/quantity': { value: 30 },
                'line_item/status': { value: 'draft' },
                'line_item/needed_by': { value: '2026-05-20' },
              },
            },
          ]),
        },
      },
    ],
  },
  {
    title: 'Nested composition',
    description:
      'These examples stress the hierarchy rules so you can see whether deeper schemas still feel deliberate and readable.',
    examples: [
      {
        title: 'Program brief',
        description: 'A realistic mixed schema combining sections, rows, grids, collections, and nested collections.',
        span: 12,
        view: {
          viewId: 'demo-program-brief',
          version: '1',
          nodes: [
            {
              id: 'program_brief',
              type: 'group',
              label: 'Program brief',
              children: [
                {
                  id: 'program_intro',
                  type: 'presentation',
                  contentType: 'text',
                  content: 'This composition is meant to test composability, spacing, and nested hierarchy in one pass.',
                },
                {
                  id: 'program_header',
                  type: 'grid',
                  columns: 2,
                  children: [
                    { id: 'program_name', type: 'field', dataType: 'string', label: 'Program name' },
                    node({ id: 'launch_date', type: 'date', label: 'Launch date' }),
                    node({
                      id: 'region',
                      type: 'select',
                      label: 'Region',
                      options: [
                        { value: 'amer', label: 'Americas' },
                        { value: 'emea', label: 'EMEA' },
                        { value: 'apac', label: 'APAC' },
                      ],
                    }),
                    node({ id: 'readiness', type: 'slider', label: 'Readiness', min: 0, max: 10 }),
                  ],
                },
                {
                  id: 'milestones',
                  type: 'collection',
                  label: 'Milestones',
                  minItems: 1,
                  template: {
                    id: 'milestone',
                    type: 'group',
                    label: 'Milestone',
                    children: [
                      {
                        id: 'summary',
                        type: 'row',
                        children: [
                          { id: 'milestone_name', type: 'field', dataType: 'string', label: 'Milestone name' },
                          node({ id: 'milestone_date', type: 'date', label: 'Date' }),
                        ],
                      },
                      {
                        id: 'details',
                        type: 'grid',
                        columns: 2,
                        children: [
                          node({
                            id: 'owner',
                            type: 'radio-group',
                            label: 'Owner',
                            options: [
                              { value: 'product', label: 'Product' },
                              { value: 'design', label: 'Design' },
                              { value: 'engineering', label: 'Engineering' },
                            ],
                          }),
                          node({ id: 'risk_level', type: 'slider', label: 'Risk', min: 0, max: 5 }),
                          node({ id: 'summary_notes', type: 'textarea', label: 'Notes' }),
                          node({ id: 'approved', type: 'toggle', label: 'Approved for build' }),
                        ],
                      },
                      {
                        id: 'tasks',
                        type: 'collection',
                        label: 'Tasks',
                        minItems: 1,
                        template: {
                          id: 'task',
                          type: 'group',
                          label: 'Task',
                          children: [
                            { id: 'task_name', type: 'field', dataType: 'string', label: 'Task name' },
                            node({ id: 'task_done', type: 'toggle', label: 'Done' }),
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  id: 'program_footer',
                  type: 'row',
                  children: [
                    { id: 'footer_copy', type: 'presentation', contentType: 'text', content: 'A calm system should keep this structure readable without visual noise.' },
                    { id: 'approve_program', type: 'action', intentId: 'demo.submit', label: 'Approve program' },
                  ],
                },
              ],
            },
          ],
        },
        initialValues: {
          'program_brief/program_header/program_name': { value: 'Atlas relaunch' },
          'program_brief/program_header/launch_date': { value: '2026-07-09' },
          'program_brief/program_header/region': { value: 'emea' },
          'program_brief/program_header/readiness': { value: 8 },
          'program_brief/milestones': collectionValue([
            {
              values: {
                'milestone/summary/milestone_name': { value: 'Discovery' },
                'milestone/summary/milestone_date': { value: '2026-04-20' },
                'milestone/details/owner': { value: 'product' },
                'milestone/details/risk_level': { value: 2 },
                'milestone/details/summary_notes': { value: 'Align language, hierarchy, and examples.' },
                'milestone/details/approved': { value: true },
                'milestone/tasks': collectionValue([
                  {
                    values: {
                      'task/task_name': { value: 'Audit primitives' },
                      'task/task_done': { value: true },
                    },
                  },
                  {
                    values: {
                      'task/task_name': { value: 'Prototype nested collection treatment' },
                      'task/task_done': { value: false },
                    },
                  },
                ]),
              },
            },
            {
              values: {
                'milestone/summary/milestone_name': { value: 'Launch' },
                'milestone/summary/milestone_date': { value: '2026-07-09' },
                'milestone/details/owner': { value: 'engineering' },
                'milestone/details/risk_level': { value: 3 },
                'milestone/details/summary_notes': { value: 'Keep the demo intentionally quiet.' },
                'milestone/details/approved': { value: false },
                'milestone/tasks': collectionValue([
                  {
                    values: {
                      'task/task_name': { value: 'QA the full showcase' },
                      'task/task_done': { value: false },
                    },
                  },
                ]),
              },
            },
          ]),
        },
      },
    ],
  },
];
