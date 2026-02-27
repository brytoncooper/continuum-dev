import { useContext } from 'react';
import type { SchemaSnapshot, ComponentDefinition } from '@continuum/contract';
import { ContinuumContext } from './context.js';
import { useContinuumState } from './hooks.js';
import { FallbackComponent } from './fallback.js';
import { ComponentErrorBoundary } from './error-boundary.js';

function ComponentNode({ definition }: { definition: ComponentDefinition }) {
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

  const childNodes = definition.children?.map((child) => (
    <ComponentNode key={child.id} definition={child} />
  ));

  return (
    <div data-continuum-id={definition.id}>
      <ComponentErrorBoundary componentId={definition.id}>
        <Component
          value={value}
          onChange={setValue}
          definition={definition}
          {...(definition.props ?? {})}
        >
          {childNodes}
        </Component>
      </ComponentErrorBoundary>
    </div>
  );
}

export function ContinuumRenderer({ schema }: { schema: SchemaSnapshot }) {
  return (
    <div data-continuum-schema={schema.schemaId}>
      {(schema.components ?? []).map((comp) => (
        <ComponentNode key={comp.id} definition={comp} />
      ))}
    </div>
  );
}
