// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { ContinuumProvider, useContinuumSession } from '@continuum-dev/react';
import type { ViewDefinition } from '@continuum-dev/core';
import { starterKitComponentMap } from '../component-map.js';
import { StarterKitSessionWorkbench } from './session-workbench.js';

const initialView: ViewDefinition = {
  viewId: 'profile',
  version: '1',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      children: [
        {
          id: 'email',
          type: 'field',
          dataType: 'string',
          key: 'person.email',
          semanticKey: 'person.email',
          label: 'Email',
        },
      ],
    },
  ],
};

const draftView: ViewDefinition = {
  viewId: 'profile',
  version: '2',
  nodes: [
    {
      id: 'profile',
      type: 'group',
      children: [
        {
          id: 'secondary_email',
          type: 'field',
          dataType: 'string',
          key: 'person.secondaryEmail',
          label: 'Secondary email',
        },
      ],
    },
  ],
};

function DraftRestoreWorkbench() {
  const session = useContinuumSession();

  useEffect(() => {
    if (session.getSnapshot()) {
      return;
    }

    session.pushView(initialView);
    session.updateState('profile/email', {
      value: 'user@example.com',
      isDirty: true,
    });

    const draft = session.beginStream({
      targetViewId: 'profile',
      mode: 'draft',
    });
    session.applyStreamPart(draft.streamId, {
      kind: 'view',
      view: draftView,
    });
  }, [session]);

  return <StarterKitSessionWorkbench initialView={initialView} />;
}

describe('StarterKitSessionWorkbench restore reviews', () => {
  it('shows draft restore reviews immediately and resolves them when applied', async () => {
    render(
      <ContinuumProvider components={starterKitComponentMap}>
        <DraftRestoreWorkbench />
      </ContinuumProvider>
    );

    expect(await screen.findByText('Possible restores')).toBeTruthy();
    expect(screen.getByText('In draft preview')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Secondary email')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply here' }));
    });

    await waitFor(() => {
      expect(screen.queryByText('Possible restores')).toBeNull();
    });
  });
});
