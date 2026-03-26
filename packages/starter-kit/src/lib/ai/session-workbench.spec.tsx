// @vitest-environment jsdom
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import {
  ContinuumProvider,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import type { ViewDefinition } from '@continuum-dev/core';
import { starterKitComponentMap } from '../component-map.js';
import { StarterKitSessionWorkbench } from './session-workbench.js';
import { useStarterKitTimeline } from './use-starter-kit-timeline.js';

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

const timelineInitialView: ViewDefinition = {
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

const timelineCurrentView: ViewDefinition = {
  viewId: 'profile',
  version: '2',
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
          label: 'Work email',
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

function initializeTimelineSession(
  session: ReturnType<typeof useContinuumSession>
): void {
  if (session.getSnapshot()) {
    return;
  }

  session.pushView(timelineInitialView);
  session.updateState('profile/email', {
    value: 'old@example.com',
    isDirty: true,
  });
  session.pushView(timelineCurrentView);
  session.updateState('profile/email', {
    value: 'new@example.com',
    isDirty: true,
  });
}

function TimelineProbe() {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const timeline = useStarterKitTimeline();

  useEffect(() => {
    initializeTimelineSession(session);
  }, [session]);

  return (
    <div>
      <div data-testid="timeline-state">
        {JSON.stringify({
          count: timeline.entries.length,
          current: timeline.currentEntry?.label ?? null,
          selected: timeline.selectedEntry?.label ?? null,
          preview: timeline.previewEntry?.label ?? null,
          version: snapshot?.view.version ?? null,
          entries: timeline.entries.map((entry) => ({
            label: entry.label,
            value: entry.snapshot.data.values['profile/email']?.value ?? null,
          })),
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          timeline.setSelectedEntryIndex(0);
        }}
      >
        Preview first
      </button>
      <button
        type="button"
        onClick={() => {
          timeline.clearPreview();
        }}
      >
        Clear preview
      </button>
      <button
        type="button"
        onClick={() => {
          timeline.rewindSelected();
        }}
      >
        Rewind selected
      </button>
    </div>
  );
}

function TimelineWorkbench(props: { showTimelineControls?: boolean }) {
  const session = useContinuumSession();

  useEffect(() => {
    initializeTimelineSession(session);
  }, [session]);

  return (
    <StarterKitSessionWorkbench
      initialView={timelineInitialView}
      showTimelineControls={props.showTimelineControls}
    />
  );
}

function readTimelineState(): {
  count: number;
  current: string | null;
  selected: string | null;
  preview: string | null;
  version: string | null;
  entries: Array<{ label: string; value: string | null }>;
} {
  const state = screen.getByTestId('timeline-state').textContent;
  if (!state) {
    throw new Error('Expected timeline state to be rendered');
  }

  return JSON.parse(state) as {
    count: number;
    current: string | null;
    selected: string | null;
    preview: string | null;
    version: string | null;
    entries: Array<{ label: string; value: string | null }>;
  };
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

describe('useStarterKitTimeline', () => {
  it('exposes full timeline snapshots and resets preview selection correctly', async () => {
    render(
      <ContinuumProvider components={starterKitComponentMap}>
        <TimelineProbe />
      </ContinuumProvider>
    );

    await waitFor(() => {
      expect(readTimelineState()).toMatchObject({
        count: 2,
        current: '2',
        selected: '2',
        preview: null,
        version: '2',
        entries: [
          { label: '1', value: 'old@example.com' },
          { label: '2', value: 'new@example.com' },
        ],
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview first' }));
    });

    await waitFor(() => {
      expect(readTimelineState()).toMatchObject({
        current: '2',
        selected: '1',
        preview: '1',
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear preview' }));
    });

    await waitFor(() => {
      expect(readTimelineState()).toMatchObject({
        current: '2',
        selected: '2',
        preview: null,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview first' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rewind selected' }));
    });

    await waitFor(() => {
      expect(readTimelineState()).toMatchObject({
        count: 1,
        current: '1',
        selected: '1',
        preview: null,
        version: '1',
        entries: [{ label: '1', value: 'old@example.com' }],
      });
    });
  });
});

describe('StarterKitSessionWorkbench timeline preview', () => {
  it('renders historical snapshot values in the inline timeline preview', async () => {
    render(
      <ContinuumProvider components={starterKitComponentMap}>
        <TimelineWorkbench />
      </ContinuumProvider>
    );

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    const historicalOption = Array.from(select.options).find(
      (option) => option.value !== ''
    );

    expect(historicalOption?.textContent).toBe('1');

    await act(async () => {
      fireEvent.change(select, {
        target: { value: historicalOption?.value ?? '' },
      });
    });

    expect(await screen.findByDisplayValue('old@example.com')).toBeTruthy();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel timeline preview' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('old@example.com')).toBeNull();
      expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe(
        ''
      );
    });
  });

  it('hides built-in timeline controls when showTimelineControls is false', async () => {
    render(
      <ContinuumProvider components={starterKitComponentMap}>
        <TimelineWorkbench showTimelineControls={false} />
      </ContinuumProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Timeline preview')).toBeNull();
    });
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
