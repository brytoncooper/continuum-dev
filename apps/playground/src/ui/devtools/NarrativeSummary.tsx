import type { ContinuitySnapshot } from '@continuum/contract';
import type { ReconciliationIssue, ReconciliationResolution, StateDiff } from '@continuum/runtime';
import type { AIConversationEntry } from '../../ai/types';
import { radius, space, typeScale } from '../tokens';
import { playgroundTheme } from '../playground-theme';

interface NarrativeSummaryProps {
  resolutions: ReconciliationResolution[];
  diffs: StateDiff[];
  issues: ReconciliationIssue[];
  snapshot: ContinuitySnapshot | null;
  entries: AIConversationEntry[];
}

/* ── helpers ───────────────────────────────────────────── */

function countResolutions(resolutions: ReconciliationResolution[]) {
  let carried = 0;
  let added = 0;
  let detached = 0;
  let migrated = 0;
  let restored = 0;

  for (const r of resolutions) {
    const res = r.resolution as string;
    switch (res) {
      case 'carried':
        carried++;
        break;
      case 'added':
        added++;
        break;
      case 'detached':
        detached++;
        break;
      case 'migrated':
        migrated++;
        break;
      case 'restored':
        restored++;
        break;
    }
  }

  return { carried, added, detached, migrated, restored, total: resolutions.length };
}

function countPopulatedValues(snapshot: ContinuitySnapshot | null): {
  fieldCount: number;
  collectionCount: number;
  collectionItemTotal: number;
} {
  if (!snapshot?.data?.values) return { fieldCount: 0, collectionCount: 0, collectionItemTotal: 0 };

  let fieldCount = 0;
  let collectionCount = 0;
  let collectionItemTotal = 0;

  for (const [, val] of Object.entries(snapshot.data.values)) {
    const v = val as { value?: unknown };
    if (v.value != null) {
      if (typeof v.value === 'object' && v.value !== null && 'items' in (v.value as Record<string, unknown>)) {
        collectionCount++;
        const items = (v.value as { items?: unknown[] }).items;
        if (Array.isArray(items)) collectionItemTotal += items.length;
      } else {
        fieldCount++;
      }
    }
  }

  return { fieldCount, collectionCount, collectionItemTotal };
}

function getHealthVerdict(issues: ReconciliationIssue[], resolutions: ReconciliationResolution[]) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const detached = resolutions.filter((r) => (r.resolution as string) === 'detached').length;

  if (errors > 0)
    return { icon: '❌', label: 'Errors present', tone: playgroundTheme.color.danger, bg: playgroundTheme.color.dangerBg };
  if (warnings > 0 || detached > 0)
    return { icon: '⚠️', label: 'Issues detected', tone: playgroundTheme.color.warning, bg: playgroundTheme.color.warningBg };
  return { icon: '✅', label: 'All good', tone: playgroundTheme.color.success, bg: playgroundTheme.color.successBg };
}

function buildStoryLines(
  resolutions: ReconciliationResolution[],
  diffs: StateDiff[],
  issues: ReconciliationIssue[],
  snapshot: ContinuitySnapshot | null,
  entries: AIConversationEntry[]
): string[] {
  const lines: string[] = [];
  const counts = countResolutions(resolutions);
  const pop = countPopulatedValues(snapshot);
  const latestEntry = entries[0]; // entries are newest-first

  // Last prompt context
  if (latestEntry) {
    if (latestEntry.requestError) {
      lines.push(`🚫 Last request failed: "${latestEntry.requestError}"`);
    } else if (latestEntry.validationErrors && latestEntry.validationErrors.length > 0) {
      lines.push(
        `⚠️ Last AI output had ${latestEntry.validationErrors.length} validation error${latestEntry.validationErrors.length > 1 ? 's' : ''} and was NOT applied to the view.`
      );
      // Detect flat array problem
      const flatArrayHint = latestEntry.validationErrors.some(
        (e) => e.includes('children must be an array') || e.includes('template is required')
      );
      if (flatArrayHint) {
        lines.push(
          `🔍 Pattern detected: the model likely returned a flat list of nodes instead of a nested tree. This typically happens when the model loses context about the hierarchy on follow-up prompts.`
        );
      }
    } else if (latestEntry.viewVersion) {
      lines.push(`✅ AI output was accepted and applied as version ${latestEntry.viewVersion}.`);
    }
  }

  // Resolution breakdown
  if (counts.total > 0) {
    const parts: string[] = [];
    if (counts.carried > 0) parts.push(`${counts.carried} carried`);
    if (counts.added > 0) parts.push(`${counts.added} added`);
    if (counts.migrated > 0) parts.push(`${counts.migrated} migrated`);
    if (counts.detached > 0) parts.push(`${counts.detached} detached`);
    if (counts.restored > 0) parts.push(`${counts.restored} restored`);
    lines.push(`📊 Node resolutions: ${parts.join(', ')} (${counts.total} total).`);
  }

  // Data population
  if (pop.fieldCount > 0 || pop.collectionCount > 0) {
    const parts: string[] = [];
    if (pop.fieldCount > 0) parts.push(`${pop.fieldCount} field${pop.fieldCount > 1 ? 's' : ''} populated with values`);
    if (pop.collectionCount > 0) {
      parts.push(`${pop.collectionCount} collection${pop.collectionCount > 1 ? 's' : ''} seeded (${pop.collectionItemTotal} item${pop.collectionItemTotal !== 1 ? 's' : ''})`);
    }
    lines.push(`📝 Data: ${parts.join(', ')}.`);
  }

  // Diffs
  if (diffs.length > 0) {
    const addedDiffs = diffs.filter((d) => d.type === 'added').length;
    const removedDiffs = diffs.filter((d) => d.type === 'removed').length;
    const changedDiffs = diffs.filter((d) => d.type !== 'added' && d.type !== 'removed').length;
    const dp: string[] = [];
    if (addedDiffs > 0) dp.push(`${addedDiffs} added`);
    if (removedDiffs > 0) dp.push(`${removedDiffs} removed`);
    if (changedDiffs > 0) dp.push(`${changedDiffs} changed`);
    lines.push(`🔄 Data diffs: ${dp.join(', ')}.`);
  }

  // Detached values
  const detachedCount = resolutions.filter((r) => (r.resolution as string) === 'detached').length;
  if (detachedCount > 0) {
    lines.push(
      `⚠️ ${detachedCount} node${detachedCount > 1 ? 's were' : ' was'} detached — their values are preserved in the "Detached Values" tab and can be restored.`
    );
  }

  // Issues
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');
  if (errors.length > 0) {
    lines.push(`❌ ${errors.length} runtime error${errors.length > 1 ? 's' : ''}: ${errors.map((e) => e.message).join('; ')}`);
  }
  if (warnings.length > 0) {
    lines.push(`⚠️ ${warnings.length} warning${warnings.length > 1 ? 's' : ''}: ${warnings.map((w) => w.message).join('; ')}`);
  }
  if (infos.length > 0) {
    lines.push(`ℹ️ ${infos.length} info note${infos.length > 1 ? 's' : ''}: ${infos.map((i) => i.message).join('; ')}`);
  }

  // Validation errors from latest entry (structured)
  if (latestEntry?.validationErrors && latestEntry.validationErrors.length > 0) {
    lines.push('');
    lines.push('📋 Validation error details:');
    for (const err of latestEntry.validationErrors) {
      lines.push(`   • ${err}`);
    }
  }

  // Empty state
  if (lines.length === 0) {
    lines.push('No AI interactions yet. Send a prompt to get started.');
  }

  return lines;
}

/* ── component ─────────────────────────────────────────── */

export function NarrativeSummary({
  resolutions,
  diffs,
  issues,
  snapshot,
  entries,
}: NarrativeSummaryProps) {
  const verdict = getHealthVerdict(issues, resolutions);
  const storyLines = buildStoryLines(resolutions, diffs, issues, snapshot, entries);

  return (
    <div style={{ display: 'grid', gap: space.md }}>
      {/* Health verdict banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          padding: `${space.sm}px ${space.md}px`,
          borderRadius: radius.md,
          background: verdict.bg,
          border: `1px solid ${verdict.tone}`,
        }}
      >
        <span style={{ fontSize: 20 }}>{verdict.icon}</span>
        <span style={{ ...typeScale.h3, color: verdict.tone }}>{verdict.label}</span>
      </div>

      {/* Quick stats row */}
      <div style={{ display: 'flex', gap: space.md, flexWrap: 'wrap' }}>
        <StatChip label="Nodes" value={resolutions.length} />
        <StatChip
          label="Populated"
          value={countPopulatedValues(snapshot).fieldCount}
        />
        <StatChip
          label="Collections"
          value={countPopulatedValues(snapshot).collectionCount}
        />
        <StatChip label="Diffs" value={diffs.length} />
        <StatChip
          label="Issues"
          value={issues.length}
          tone={issues.some((i) => i.severity === 'error') ? 'danger' : issues.length > 0 ? 'warning' : 'normal'}
        />
      </div>

      {/* Story */}
      <div
        style={{
          display: 'grid',
          gap: space.xs,
          padding: space.md,
          borderRadius: radius.md,
          background: playgroundTheme.color.surfaceMuted,
          border: `1px solid ${playgroundTheme.color.border}`,
        }}
      >
        {storyLines.map((line, i) =>
          line === '' ? (
            <div key={i} style={{ height: space.xs }} />
          ) : (
            <div
              key={i}
              style={{
                ...typeScale.caption,
                color: playgroundTheme.color.muted,
                lineHeight: 1.6,
              }}
            >
              {line}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ── stat chip ─────────────────────────────────────────── */

function StatChip({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: number;
  tone?: 'normal' | 'warning' | 'danger';
}) {
  const fg =
    tone === 'danger'
      ? playgroundTheme.color.danger
      : tone === 'warning'
        ? playgroundTheme.color.warning
        : playgroundTheme.color.accent;
  const bg =
    tone === 'danger'
      ? playgroundTheme.color.dangerBg
      : tone === 'warning'
        ? playgroundTheme.color.warningBg
        : playgroundTheme.color.infoBg;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.xs,
        padding: `${space.xs}px ${space.sm}px`,
        borderRadius: radius.sm,
        background: bg,
        border: `1px solid ${fg}33`,
      }}
    >
      <span style={{ ...typeScale.h3, color: fg }}>{value}</span>
      <span style={{ ...typeScale.caption, color: playgroundTheme.color.soft, fontSize: 11 }}>{label}</span>
    </div>
  );
}
