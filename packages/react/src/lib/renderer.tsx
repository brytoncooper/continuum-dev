import { memo, useContext } from 'react';
import type { ViewDefinition, ViewNode } from '@continuum/contract';
import { getChildNodes } from '@continuum/contract';
import { ContinuumContext } from './context.js';
import { useContinuumState } from './hooks.js';
import { FallbackComponent } from './fallback.js';
import { NodeErrorBoundary } from './error-boundary.js';

const noopOnChange = () => undefined;

function useResolvedComponent(definition: ViewNode) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }

  const { componentMap } = ctx;
  return (
    componentMap[definition.type] ??
    componentMap['default'] ??
    FallbackComponent
  );
}

const StatefulNodeRenderer = memo(function StatefulNodeRenderer({ definition }: { definition: ViewNode }) {
  const Component = useResolvedComponent(definition);

  const [value, setValue] = useContinuumState(definition.id);

  if (definition.hidden) {
    return null;
  }

  return (
    <div data-continuum-id={definition.id}>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={value}
          onChange={setValue}
          definition={definition}
        />
      </NodeErrorBoundary>
    </div>
  );
});

const ContainerNodeRenderer = memo(function ContainerNodeRenderer({ definition }: { definition: ViewNode }) {
  const Component = useResolvedComponent(definition);

  if (definition.hidden) {
    return null;
  }

  const childNodes = getChildNodes(definition).map((child) => (
    <NodeRenderer key={child.id} definition={child} />
  ));

  return (
    <div data-continuum-id={definition.id}>
      <NodeErrorBoundary nodeId={definition.id}>
        <Component
          value={undefined}
          onChange={noopOnChange}
          definition={definition}
        >
          {childNodes}
        </Component>
      </NodeErrorBoundary>
    </div>
  );
});

const NodeRenderer = memo(function NodeRenderer({ definition }: { definition: ViewNode }) {
  const childNodes = getChildNodes(definition);
  if (childNodes.length > 0) {
    return <ContainerNodeRenderer definition={definition} />;
  }
  return <StatefulNodeRenderer definition={definition} />;
});

export function ContinuumRenderer({ view }: { view: ViewDefinition }) {
  return (
    <div data-continuum-view={view.viewId}>
      {(view.nodes ?? []).map((node) => (
        <NodeRenderer key={node.id} definition={node} />
      ))}
    </div>
  );
}
