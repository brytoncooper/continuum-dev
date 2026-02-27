import { useState } from 'react';
import type { ReconciliationIssue } from '@continuum/runtime';
import type { OrphanedValue } from '@continuum/contract';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';
import { TraceList } from './TraceList';
import { DiffList } from './DiffList';
import { OrphanList } from './OrphanList';
import { IssuesList } from './IssuesList';
import { SnapshotViewer } from './SnapshotViewer';
import type { ReconciliationTrace, StateDiff } from '@continuum/runtime';
import type { ContinuitySnapshot } from '@continuum/contract';

type TabId = 'what-changed' | 'state-diffs' | 'saved-values' | 'validation' | 'raw-snapshot';

interface DevtoolsTabsProps {
  trace: ReconciliationTrace[];
  diffs: StateDiff[];
  orphanedValues: Record<string, OrphanedValue>;
  issues: ReconciliationIssue[];
  snapshot: ContinuitySnapshot | null;
}

const TABS: { id: TabId; label: string; getCount: (p: DevtoolsTabsProps) => number }[] = [
  { id: 'what-changed', label: 'What Changed', getCount: (p) => p.trace.length },
  { id: 'state-diffs', label: 'State Diffs', getCount: (p) => p.diffs.length },
  { id: 'saved-values', label: 'Saved Values', getCount: (p) => Object.keys(p.orphanedValues).length },
  { id: 'validation', label: 'Validation', getCount: (p) => p.issues.length },
  { id: 'raw-snapshot', label: 'Raw Snapshot', getCount: () => 0 },
];

export function DevtoolsTabs({
  trace,
  diffs,
  orphanedValues,
  issues,
  snapshot,
}: DevtoolsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('what-changed');

  return (
    <div
      data-testid="devtools"
      style={{
        background: playgroundTheme.gradient.panel,
        borderRadius: radius.lg,
        border: `1px solid ${playgroundTheme.color.border}`,
        boxShadow: playgroundTheme.shadow.card,
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
          background: playgroundTheme.color.surfaceAlt,
        }}
      >
        {TABS.map((tab) => {
          const count = tab.getCount({ trace, diffs, orphanedValues, issues, snapshot });
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
              {count > 0 && tab.id !== 'raw-snapshot' && (
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
          maxHeight: 320,
          background: playgroundTheme.color.surface,
          overflow: 'auto',
        }}
      >
        {activeTab === 'what-changed' && (
          <div data-testid="panel-trace">
            <TraceList trace={trace} />
          </div>
        )}
        {activeTab === 'state-diffs' && (
          <div data-testid="panel-diffs">
            <DiffList diffs={diffs} />
          </div>
        )}
        {activeTab === 'saved-values' && (
          <div data-testid="panel-orphans">
            <OrphanList orphanedValues={orphanedValues} />
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
