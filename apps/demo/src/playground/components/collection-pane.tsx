import { getChildNodes } from '@continuum-dev/contract';
import type {
  CollectionNodeState,
  NodeValue,
  ViewDefinition,
  ViewNode,
} from '@continuum-dev/contract';
import {
  ContinuumProvider,
  ContinuumRenderer,
  useContinuumSession,
  useContinuumSnapshot,
} from '@continuum-dev/react';
import { useEffect, useMemo } from 'react';
import { componentMap } from '../../component-map';
import { ExampleCard } from '../../ui/layout';
import { color, radius, space, type } from '../../ui/tokens';
import { createHighlightedComponentMap } from './highlighted-node-map';
import { StateSummaryCard } from './state-summary-card';
import { StaticViewRenderer } from './static-view-renderer';
import type {
  PlaygroundCollectionScenario,
  PlaygroundCollectionReplayState,
} from '../types';

const statusRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space.md,
  flexWrap: 'wrap',
} as const;

const statusChipStyle = (status: string) =>
  ({
    ...type.small,
    color: color.text,
    padding: `${space.sm}px ${space.md}px`,
    borderRadius: radius.pill,
    border: `1px solid ${
      status.includes('lost') ? color.borderStrong : color.border
    }`,
    background: color.surface,
  } as const);

const previewStyle = {
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  pointerEvents: 'none',
} as const;

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space.md,
} as const;

const fullRowStyle = {
  gridColumn: '1 / -1',
} as const;

const explanationCardStyle = {
  display: 'grid',
  gap: space.sm,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
} as const;

const explanationTitleStyle = {
  ...type.label,
  color: color.textSoft,
} as const;

const explanationBodyStyle = {
  ...type.body,
  color: color.text,
} as const;

const preStyle = {
  ...type.small,
  color: color.text,
  margin: 0,
  padding: space.lg,
  borderRadius: radius.md,
  border: `1px solid ${color.borderSoft}`,
  background: color.surfaceMuted,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
} as const;

const contentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: space.lg,
  flex: 1,
  justifyContent: 'flex-start' as const,
} as const;

function scopedNodeId(nodeId: string, parentNodeId?: string): string {
  return parentNodeId ? `${parentNodeId}/${nodeId}` : nodeId;
}

function collectVisibleRelativeIds(
  node: ViewNode,
  parentNodeId?: string
): string[] {
  const nodeId = scopedNodeId(node.id, parentNodeId);
  const childNodes = getChildNodes(node);

  if (childNodes.length === 0) {
    return 'key' in node && typeof node.key === 'string' ? [nodeId] : [];
  }

  return childNodes.flatMap((childNode) =>
    collectVisibleRelativeIds(childNode, nodeId)
  );
}

function currentItemCount(
  values: Record<string, NodeValue>,
  collectionNodeId: string
): number {
  return (
    (values[collectionNodeId] as NodeValue<CollectionNodeState> | undefined)
      ?.value?.items ?? []
  ).length;
}

function visibleValueCount(
  view: ViewDefinition,
  values: Record<string, NodeValue>,
  collectionNodeId: string
): number {
  const collectionNode = view.nodes.find(
    (node) => node.type === 'collection' && node.id === collectionNodeId
  ) as ViewNode | undefined;

  if (!collectionNode || !('template' in collectionNode)) {
    return 0;
  }

  const visibleRelativeIds = new Set(
    collectVisibleRelativeIds(collectionNode.template)
  );
  const items =
    (values[collectionNodeId] as NodeValue<CollectionNodeState> | undefined)
      ?.value?.items ?? [];

  return items.reduce((count, item) => {
    return (
      count +
      Object.keys(item.values ?? {}).filter((relativeId) =>
        visibleRelativeIds.has(relativeId)
      ).length
    );
  }, 0);
}

function replayNaiveCollectionScenario(
  scenario: PlaygroundCollectionScenario,
  stepIndex: number,
  inputValues: Record<string, string>
): PlaygroundCollectionReplayState {
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );
  const currentView = scenario.steps[boundedStepIndex].view;
  const values = {
    [scenario.collectionNodeId]: scenario.buildCollectionValue(inputValues),
  };
  const visibleValues = visibleValueCount(
    currentView,
    values,
    scenario.collectionNodeId
  );

  return {
    view: currentView,
    values,
    itemCount: currentItemCount(values, scenario.collectionNodeId),
    status:
      boundedStepIndex === 0
        ? 'User data staged'
        : visibleValues > 0
        ? 'Collection values partially visible'
        : 'Item values lost on naive path',
  };
}

function CollectionPaneCard({
  title,
  description,
  status,
  modelDescription,
  collectionKey,
  itemCount,
  seededValueCount,
  visibleCount,
  values,
  preview,
}: {
  title: string;
  description: string;
  status: string;
  modelDescription: string;
  collectionKey: string;
  itemCount: number;
  seededValueCount: number;
  visibleCount: number;
  values: Record<string, NodeValue>;
  preview: JSX.Element;
}) {
  return (
    <ExampleCard title={title} description={description} span={6} fullHeight>
      <div style={contentStyle}>
        <div style={statusRowStyle}>
          <div style={statusChipStyle(status)}>{status}</div>
        </div>
        <div style={previewStyle}>{preview}</div>
        <div style={summaryGridStyle}>
          <div style={fullRowStyle}>
            <div style={explanationCardStyle}>
              <div style={explanationTitleStyle}>
                Why this pane behaves this way
              </div>
              <div style={explanationBodyStyle}>{modelDescription}</div>
            </div>
          </div>
          <div style={fullRowStyle}>
            <StateSummaryCard
              title="Tracked collection"
              rows={[
                { label: 'Semantic key', value: collectionKey },
                { label: 'Items present now', value: String(itemCount) },
                {
                  label: 'Seeded user values',
                  value: String(seededValueCount),
                },
                { label: 'Visible values now', value: String(visibleCount) },
              ]}
            />
          </div>
        </div>
        <pre style={preStyle}>{JSON.stringify(values, null, 2)}</pre>
      </div>
    </ExampleCard>
  );
}

function ContinuumCollectionRuntime({
  scenario,
  stepIndex,
  inputValues,
}: {
  scenario: PlaygroundCollectionScenario;
  stepIndex: number;
  inputValues: Record<string, string>;
}) {
  const session = useContinuumSession();
  const snapshot = useContinuumSnapshot();
  const boundedStepIndex = Math.max(
    0,
    Math.min(stepIndex, scenario.steps.length - 1)
  );

  useEffect(() => {
    session.reset();
    session.pushView(scenario.steps[0].view);
    session.updateState(
      scenario.collectionNodeId,
      scenario.buildCollectionValue(inputValues)
    );

    for (let index = 1; index <= boundedStepIndex; index += 1) {
      session.pushView(scenario.steps[index].view);
    }
  }, [boundedStepIndex, inputValues, scenario, session]);

  const currentView = snapshot?.view ?? scenario.steps[boundedStepIndex].view;
  const values = snapshot?.data.values ?? {};
  const visibleCount = visibleValueCount(
    currentView,
    values,
    scenario.collectionNodeId
  );
  const seededValueCount = scenario.inputFields?.length ?? 0;

  return (
    <CollectionPaneCard
      title="With Continuum Reconciliation"
      description="The same collection template upgrade remaps the repeated item values into the richer item shape."
      status={
        boundedStepIndex === 0 ? 'User data staged' : 'Item values preserved'
      }
      modelDescription="Continuum keeps the collection state and remaps each repeated item's stored values into the evolved template path."
      collectionKey={scenario.collectionKey}
      itemCount={currentItemCount(values, scenario.collectionNodeId)}
      seededValueCount={seededValueCount}
      visibleCount={visibleCount}
      values={values}
      preview={<ContinuumRenderer view={currentView} />}
    />
  );
}

export function CollectionPane({
  scenario,
  stepIndex,
  mode,
  inputValues,
}: {
  scenario: PlaygroundCollectionScenario;
  stepIndex: number;
  mode: 'naive' | 'continuum';
  inputValues: Record<string, string>;
}) {
  const previewComponentMap = useMemo(
    () =>
      createHighlightedComponentMap(
        stepIndex === 0
          ? {}
          : {
              'contact.name': { tone: 'error' },
              'contact.company': { tone: 'error' },
            }
      ),
    [stepIndex]
  );

  if (mode === 'continuum') {
    return (
      <ContinuumProvider components={componentMap} persist={false}>
        <ContinuumCollectionRuntime
          scenario={scenario}
          stepIndex={stepIndex}
          inputValues={inputValues}
        />
      </ContinuumProvider>
    );
  }

  const replay = replayNaiveCollectionScenario(
    scenario,
    stepIndex,
    inputValues
  );

  return (
    <CollectionPaneCard
      title="Without Continuum Reconciliation"
      description="The repeated collection survives, but the item field paths no longer match the upgraded template so the user-entered item values disappear."
      status={replay.status}
      modelDescription="The collection value is still sitting on the old item field ids. When the repeated template path changes, the naive path cannot remap those item values into the new shape."
      collectionKey={scenario.collectionKey}
      itemCount={replay.itemCount}
      seededValueCount={scenario.inputFields?.length ?? 0}
      visibleCount={visibleValueCount(
        replay.view,
        replay.values,
        scenario.collectionNodeId
      )}
      values={replay.values}
      preview={
        <StaticViewRenderer
          view={replay.view}
          values={replay.values}
          onChange={() => undefined}
          components={previewComponentMap}
        />
      }
    />
  );
}
