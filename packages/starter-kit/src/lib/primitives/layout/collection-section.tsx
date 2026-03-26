import type { CSSProperties } from 'react';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { color, radius, space, type } from '../../tokens.js';
import {
  starterKitDefaultStyles,
  useStarterKitStyle,
} from '../../style-config.js';
import {
  nodeDepth,
  nodeDescription,
  nodeLabel,
  nodeNumberProp,
} from '../shared/node.js';
import {
  responsiveGridColumns,
  useCompactViewport,
} from '../shared/responsive-layout.js';

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

export function CollectionSection({
  definition,
  children,
  nodeId,
  canAdd,
  onAdd,
}: ContinuumNodeProps) {
  const label = nodeLabel(definition);
  const description = nodeDescription(definition);
  const depth = nodeDepth(nodeId);
  const isCompact = useCompactViewport();
  const columns = nodeNumberProp(definition, 'columns', 1);
  const minItemWidth = nodeNumberProp(definition, 'minItemWidth', 280);
  const addButtonStyle = useStarterKitStyle(
    'collectionAddButton',
    starterKitDefaultStyles.collectionAddButton
  );

  return (
    <section
      style={{
        display: 'grid',
        gap: space.md,
        padding: depth === 0 ? space.lg : 0,
        borderRadius: depth === 0 ? radius.md : 0,
        background: depth === 0 ? color.surface : 'transparent',
        border: depth === 0 ? `1px solid ${color.borderSoft}` : 'none',
      }}
    >
      {label || description ? (
        <div style={headerStyle}>
          {label ? (
            <div style={{ ...type.section, color: color.text }}>{label}</div>
          ) : null}
          {description ? (
            <div style={{ ...type.small, color: color.textMuted }}>
              {description}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: space.sm,
          gridTemplateColumns:
            !isCompact && columns > 1
              ? responsiveGridColumns(columns, minItemWidth, space.sm)
              : 'minmax(0, 1fr)',
        }}
      >
        {children}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          style={{
            ...addButtonStyle,
            width: 'auto',
            minWidth: 132,
            maxWidth: '100%',
          }}
          disabled={!canAdd}
          onClick={() => {
            if (typeof onAdd === 'function') {
              onAdd();
            }
          }}
        >
          Add item
        </button>
      </div>
    </section>
  );
}
