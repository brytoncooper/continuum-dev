import { useState } from 'react';
import type { ReconciliationIssue, ReconciliationResolution, StateDiff } from '@continuum/runtime';
import type { DetachedValue, ContinuitySnapshot } from '@continuum/contract';
import type { AIConversationEntry } from '../../ai/types';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';
import { NarrativeSummary } from './NarrativeSummary';
import { ResolutionList } from './ResolutionList';
import { DiffList } from './DiffList';
import { DetachedList } from './DetachedList';
import { IssuesList } from './IssuesList';
import { SnapshotViewer } from './SnapshotViewer';

type TabId = 'narrative' | 'what-changed' | 'state-diffs' | 'saved-values' | 'validation' | 'raw-snapshot';

interface DevtoolsTabsProps {
  resolutions: ReconciliationResolution[];
  diffs: StateDiff[];
  detachedValues: Record<string, DetachedValue>;
  issues: ReconciliationIssue[];
  snapshot: ContinuitySnapshot | null;
  entries: AIConversationEntry[];
}

const TABS: { id: TabId; label: string; getCount: (p: DevtoolsTabsProps) => number }[] = [
  { id: 'narrative', label: '📖 Narrative', getCount: () => 0 },
  { id: 'what-changed', label: 'What Changed', getCount: (p) => p.resolutions.length },
  { id: 'state-diffs', label: 'Data Diffs', getCount: (p) => p.diffs.length },
  { id: 'saved-values', label: 'Detached Values', getCount: (p) => Object.keys(p.detachedValues).length },
  { id: 'validation', label: 'Validation', getCount: (p) => p.issues.length },
  { id: 'raw-snapshot', label: 'Raw Snapshot', getCount: () => 0 },
];

export function DevtoolsTabs({
  resolutions,
  diffs,
  detachedValues,
  issues,
  snapshot,
  entries,
}: DevtoolsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('narrative');

  return (
    <div
      data-testid="devtools"
      style={{
        background: playgroundTheme.color.panel,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.panelBorder}`,
        boxShadow: `${playgroundTheme.shadow.card}, inset 0 0 0 1px ${playgroundTheme.color.borderGlow}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: space.xs,
          padding: `${space.sm}px ${space.md}px`,
          borderBottom: `1px solid ${playgroundTheme.color.border}`,
          background: `linear-gradient(132deg, ${playgroundTheme.color.surfaceAlt}, rgba(244, 250, 255, 0.95))`,
        }}
      >
        {TABS.map((tab) => {
          const count = tab.getCount({ resolutions, diffs, detachedValues, issues, snapshot, entries });
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none',
                background: isActive ? playgroundTheme.color.surface : 'transparent',
                color: isActive ? playgroundTheme.color.text : playgroundTheme.color.muted,
                borderRadius: radius.sm,
                padding: `${space.sm}px ${space.md}px`,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                position: 'relative',
                ...typeScale.caption,
                display: 'flex',
                alignItems: 'center',
                gap: space.xs,
                borderBottom: isActive ? `2px solid ${playgroundTheme.color.accent}` : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tab.label}
              {count > 0 && tab.id !== 'raw-snapshot' && tab.id !== 'narrative' && (
                <span
                  style={{
                    background: isActive ? playgroundTheme.color.accent : playgroundTheme.color.border,
                    color: isActive ? playgroundTheme.color.white : playgroundTheme.color.soft,
                    borderRadius: radius.pill,
                    padding: `0 ${space.xs}px`,
                    fontSize: 10,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        style={{
          padding: space.lg,
          maxHeight: 480,
          background: playgroundTheme.color.surface,
          overflow: 'auto',
        }}
      >
        {activeTab === 'narrative' && (
          <div data-testid="panel-narrative">
            <NarrativeSummary
              resolutions={resolutions}
              diffs={diffs}
              issues={issues}
              snapshot={snapshot}
              entries={entries}
            />
          </div>
        )}
        {activeTab === 'what-changed' && (
          <div data-testid="panel-resolutions">
            <ResolutionList resolutions={resolutions} />
          </div>
        )}
        {activeTab === 'state-diffs' && (
          <div data-testid="panel-diffs">
            <DiffList diffs={diffs} />
          </div>
        )}
        {activeTab === 'saved-values' && (
          <div data-testid="panel-detached">
            <DetachedList detachedValues={detachedValues} />
          </div>
        )}
        {activeTab === 'validation' && (
          <div data-testid="panel-issues">
            <IssuesList issues={issues} />
          </div>
        )}
        {activeTab === 'raw-snapshot' && (
          <div data-testid="panel-snapshot">
            <SnapshotViewer snapshot={snapshot} />
          </div>
        )}
      </div>
    </div>
  );
}
