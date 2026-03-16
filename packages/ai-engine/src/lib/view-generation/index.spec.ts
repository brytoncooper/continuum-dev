import {
  applyPatchPlanToView,
  buildViewLineDslSystemPrompt,
  buildStarterKitStateTargetCatalog,
  parseStarterKitStateResponse,
  parseViewAuthoringToViewDefinition,
  parseViewLineDslToViewDefinition,
  runStarterKitViewGeneration,
  type StarterKitSessionLike,
} from '../../index.js';
import type { AiConnectClient } from '@continuum-dev/ai-connect';
import type { ViewDefinition } from '@continuum-dev/core';

describe('@continuum-dev/ai-engine behavior', () => {
  it('exports provider-neutral line-dsl helpers', () => {
    const systemPrompt = buildViewLineDslSystemPrompt({
      mode: 'create-view',
    });
    const parsed = parseViewLineDslToViewDefinition({
      text: `view viewId="profile" version="2"
group id="profile_group" label="Profile"
  field id="email" key="person.email" label="Email" dataType="string"`,
    });

    expect(systemPrompt).toContain('Return only Continuum View DSL.');
    expect(parsed?.viewId).toBe('profile');
    expect(parsed?.nodes).toHaveLength(1);
  });

  it('parses line-dsl and yaml authoring formats', () => {
    const fallbackView: ViewDefinition = {
      viewId: 'profile',
      version: '1',
      nodes: [],
    };

    const dsl = parseViewAuthoringToViewDefinition({
      format: 'line-dsl',
      text: `view viewId="profile" version="2"
group id="profile_group" label="Profile"
  field id="email" key="person.email" label="Email" dataType="string"`,
      fallbackView,
    });

    const yaml = parseViewAuthoringToViewDefinition({
      format: 'yaml',
      text: `viewId: profile
version: "2"
nodes:
  - id: profile_group
    type: group
    label: Profile
    children:
      - id: email
        type: field
        dataType: string
        key: person.email
        label: Email`,
      fallbackView,
    });

    expect(dsl?.nodes).toHaveLength(1);
    expect(yaml?.nodes).toHaveLength(1);
    expect(dsl?.viewId).toBe('profile');
    expect(yaml?.viewId).toBe('profile');
  });

  it('resolves state targets and parses state responses', () => {
    const view: ViewDefinition = {
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          label: 'Profile',
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'person.email',
              label: 'Email',
              dataType: 'string',
            },
          ],
        },
      ],
    };

    const targets = buildStarterKitStateTargetCatalog(view);
    const parsed = parseStarterKitStateResponse({
      text: JSON.stringify({
        updates: [
          {
            key: 'person.email',
            value: 'jordan@example.com',
          },
        ],
        status: 'Updated email',
      }),
      targetCatalog: targets,
    });

    expect(parsed?.updates).toEqual([
      {
        nodeId: 'profile_group/email',
        value: { value: 'jordan@example.com' },
      },
    ]);
    expect(parsed?.status).toBe('Updated email');
  });

  it('applies localized patch plans without regenerating the whole view', () => {
    const view: ViewDefinition = {
      viewId: 'profile',
      version: '1',
      nodes: [
        {
          id: 'profile_group',
          type: 'group',
          label: 'Profile',
          children: [
            {
              id: 'email',
              type: 'field',
              key: 'person.email',
              label: 'Email',
              dataType: 'string',
            },
          ],
        },
      ],
    };

    const patched = applyPatchPlanToView(view, {
      mode: 'patch',
      operations: [
        {
          kind: 'insert-node',
          parentId: 'profile_group',
          position: {
            afterId: 'email',
          },
          node: {
            id: 'phone',
            type: 'field',
            key: 'person.phone',
            label: 'Phone',
            dataType: 'string',
          },
        },
      ],
    });

    const profileGroup = patched?.nodes[0];
    expect(profileGroup && 'children' in profileGroup ? profileGroup.children : []).toHaveLength(2);
  });

  it('auto-applies normalized views through the shared engine', async () => {
    let snapshot: ViewDefinition = {
      viewId: 'empty',
      version: '1',
      nodes: [],
    };

    const session: StarterKitSessionLike = {
      sessionId: 'session-1',
      getSnapshot: () => ({
        view: snapshot,
        data: { values: {} },
      }),
      getDetachedValues: () => ({}),
      getIssues: () => [],
      pushView: (view) => {
        snapshot = view;
      },
      getPendingProposals: () => ({}),
      acceptProposal: () => undefined,
      rejectProposal: () => undefined,
      rewind: () => undefined,
      reset: () => undefined,
      updateState: () => undefined,
      proposeValue: () => undefined,
    };

    const provider: AiConnectClient = {
      id: 'openai',
      label: 'OpenAI',
      kind: 'openai',
      defaultModel: 'gpt-5',
      supportsJsonSchema: true,
      async generate() {
        return {
          providerId: 'openai',
          model: 'gpt-5',
          text: `view viewId="loan_form" version="1"
group id="loan_group" label="Loan intake"
  field id="borrower_name" key="borrower.name" label="Borrower name" dataType="string"`,
          json: null,
          raw: null,
        };
      },
    };

    const result = await runStarterKitViewGeneration({
      provider,
      session: {
        sessionId: session.sessionId,
        getSnapshot: session.getSnapshot,
        getCommittedSnapshot: () => undefined,
        getDetachedValues: session.getDetachedValues,
        getIssues: session.getIssues,
        applyView: (view) => {
          snapshot = view;
        },
        getPendingProposals: session.getPendingProposals,
        getPendingRestoreReviews: () => [],
        acceptProposal: session.acceptProposal,
        rejectProposal: session.rejectProposal,
        acceptRestoreCandidate: () => undefined,
        rejectRestoreReview: () => undefined,
        rewind: session.rewind,
        reset: session.reset,
        updateState: session.updateState,
        proposeValue: session.proposeValue,
      },
      instruction: 'Create a loan intake form',
      mode: 'create-view',
      autoApplyView: true,
    });

    expect(snapshot.viewId).toBe('loan_form');
    expect(result.status).toContain('Applied');
  });
});
