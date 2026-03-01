import { useContext } from 'react';
import type { ViewDefinition, ViewNode } from '@continuum/contract';
import { getChildNodes } from '@continuum/contract';
import { ContinuumContext } from './context.js';
import { useContinuumState } from './hooks.js';
import { FallbackComponent } from './fallback.js';
import { NodeErrorBoundary } from './error-boundary.js';

function NodeRenderer({ definition }: { definition: ViewNode }) {
  const ctx = useContext(ContinuumContext);
  if (!ctx) {
    throw new Error(
      'ContinuumRenderer must be used within a <ContinuumProvider>'
    );
  }

  const { componentMap } = ctx;
  const Component =
    componentMap[definition.type] ??
    componentMap['default'] ??
    FallbackComponent;

  const [value, setValue] = useContinuumState(definition.id);

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
          value={value}
          onChange={setValue}
          definition={definition}
        >
          {childNodes}
        </Component>
      </NodeErrorBoundary>
    </div>
  );
}

export function ContinuumRenderer({ view }: { view: ViewDefinition }) {
  return (
    <div data-continuum-view={view.viewId}>
      {(view.nodes ?? []).map((node) => (
        <NodeRenderer key={node.id} definition={node} />
      ))}
    </div>
  );
}
