import { useContext, useMemo } from 'react';
import type {
  ContinuitySnapshot,
  DetachedRestoreScope,
  NodeValue,
  ViewDefinition,
} from '@continuum-dev/core';
import {
  ContinuumRenderScopeContext,
  ContinuumRenderSnapshotContext,
} from '../context/render-contexts.js';
import { ContinuumContext } from '../context/render-contexts.js';
import { NodeStateScopeContext } from '../hooks/scope.js';
import { NodeRenderer } from './node-renderers.js';

const LIVE_RENDER_SCOPE: DetachedRestoreScope = { kind: 'live' };

export interface ContinuumRendererProps {
  view: ViewDefinition;
  snapshotOverride?: ContinuitySnapshot | null;
  renderScope?: DetachedRestoreScope | null;
}

/**
 * Renders a `ViewDefinition` tree using components registered in `ContinuumProvider`.
 */
export function ContinuumRenderer({
  view,
  snapshotOverride = null,
  renderScope,
}: ContinuumRendererProps) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }

  const resolvedRenderScope =
    renderScope === undefined || renderScope === null ? LIVE_RENDER_SCOPE : renderScope;

  const rootScope = useMemo(() => {
    if (!snapshotOverride) {
      return null;
    }

    if (resolvedRenderScope?.kind === 'draft') {
      const readDraftSnapshot = () =>
        ctx.store
          .getStreams()
          .find(
            (stream) =>
              stream.streamId === resolvedRenderScope.streamId &&
              stream.status === 'open' &&
              stream.mode === 'draft'
          )?.previewData ?? snapshotOverride.data;

      return {
        subscribeNode: (_nodeId: string, listener: () => void) =>
          ctx.store.subscribeStreams(listener),
        getNodeValue: (nodeId: string) =>
          readDraftSnapshot().values?.[nodeId] as NodeValue | undefined,
        setNodeValue: (nodeId: string, value: NodeValue) => {
          ctx.session.updateStateInScope(nodeId, value, resolvedRenderScope);
        },
      };
    }

    return {
      subscribeNode: (_nodeId: string, _listener: () => void) => () => undefined,
      getNodeValue: (nodeId: string) =>
        snapshotOverride.data.values?.[nodeId] as NodeValue | undefined,
      setNodeValue: (nodeId: string, value: NodeValue) => {
        ctx.session.updateStateInScope(nodeId, value, resolvedRenderScope);
      },
    };
  }, [ctx.session, ctx.store, resolvedRenderScope, snapshotOverride]);

  const renderedNodes = (
    <>
      {(view.nodes ?? []).map((node) => (
        <NodeRenderer key={node.id} definition={node} parentPath="" />
      ))}
    </>
  );
  return (
    <ContinuumRenderSnapshotContext.Provider value={snapshotOverride}>
      <ContinuumRenderScopeContext.Provider value={resolvedRenderScope}>
        {rootScope ? (
          <NodeStateScopeContext.Provider value={rootScope}>
            {renderedNodes}
          </NodeStateScopeContext.Provider>
        ) : (
          renderedNodes
        )}
      </ContinuumRenderScopeContext.Provider>
    </ContinuumRenderSnapshotContext.Provider>
  );
}
