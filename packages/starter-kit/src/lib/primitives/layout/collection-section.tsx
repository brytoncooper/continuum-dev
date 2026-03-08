import type { CSSProperties } from 'react';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import { color, radius, space, type } from '../../tokens.js';
import { starterKitDefaultStyles, useStarterKitStyle } from '../../style-config.js';
import { nodeDepth, nodeDescription, nodeLabel } from '../shared/node.js';

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
  const addButtonStyle = useStarterKitStyle('collectionAddButton', starterKitDefaultStyles.collectionAddButton);

  return (
    <section
      style={{
        display: 'grid',
        gap: space.lg,
        padding: depth === 0 ? space.xxl : 0,
        borderRadius: depth === 0 ? radius.lg : 0,
        background: depth === 0 ? color.surface : 'transparent',
        border: depth === 0 ? `1px solid ${color.border}` : 'none',
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
      <div style={{ display: 'grid', gap: space.md }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          style={addButtonStyle}
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
