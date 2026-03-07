import type { CSSProperties } from 'react';
import type { ContinuumNodeProps } from '@continuum/react';
import { color, control, radius, space, type } from '../../ui/tokens';
import { nodeDepth, nodeDescription, nodeLabel } from '../shared/node';

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const addButtonStyle: CSSProperties = {
  height: control.height,
  padding: `0 ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
  flexShrink: 0,
};

export function CollectionSection({
  definition,
  children,
  nodeId,
  canAdd,
  onAdd,
}: ContinuumNodeProps) {
  const depth = nodeDepth(nodeId);

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
      <div style={headerStyle}>
        <div style={{ ...type.section, color: color.text }}>{nodeLabel(definition)}</div>
        {nodeDescription(definition) ? (
          <div style={{ ...type.small, color: color.textMuted }}>{nodeDescription(definition)}</div>
        ) : null}
      </div>
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
