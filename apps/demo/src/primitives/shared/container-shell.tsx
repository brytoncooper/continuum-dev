import type { CSSProperties, ReactNode } from 'react';
import { color, control, radius, space, type } from '../../ui/tokens';
import { nodeDepth } from './node';

const headingStyle: CSSProperties = {
  display: 'grid',
  gap: space.xs,
};

const titleStyle: CSSProperties = {
  ...type.section,
  color: color.text,
};

const textStyle: CSSProperties = {
  ...type.small,
  color: color.textMuted,
};

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space.md,
  minHeight: control.height,
};

const itemLabelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

const removeButtonStyle: CSSProperties = {
  height: control.height,
  padding: `0 ${space.md}px`,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
};

const iconRemoveButtonStyle: CSSProperties = {
  width: control.height,
  height: control.height,
  padding: 0,
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.surface,
  color: color.text,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  ...type.section,
};

function hierarchyStyle(depth: number, isItem: boolean): CSSProperties {
  if (isItem) {
    return {
      padding: space.lg,
      borderRadius: radius.md,
      background: color.surface,
      border: `1px solid ${color.borderSoft}`,
    };
  }

  if (depth === 0) {
    return {
      padding: space.xxl,
      borderRadius: radius.lg,
      background: color.surface,
      border: `1px solid ${color.border}`,
    };
  }

  return {
    paddingLeft: depth === 1 ? space.lg : space.md,
    borderLeft: `1px solid ${depth === 1 ? color.border : color.borderSoft}`,
  };
}

export function ContainerShell({
  title,
  description,
  nodeId,
  itemIndex,
  canRemove,
  onRemove,
  children,
  layoutStyle,
  itemRemovePlacement = 'header',
  itemRemoveVariant = 'default',
}: {
  title: string;
  description?: string;
  nodeId?: string;
  itemIndex?: number;
  canRemove?: boolean;
  onRemove?: () => void;
  children: ReactNode;
  layoutStyle: CSSProperties;
  itemRemovePlacement?: 'header' | 'inline';
  itemRemoveVariant?: 'default' | 'icon';
}) {
  const depth = nodeDepth(nodeId);
  const isItem = typeof itemIndex === 'number';
  const removeButton =
    canRemove ? (
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove item"
        style={itemRemoveVariant === 'icon' ? iconRemoveButtonStyle : removeButtonStyle}
      >
        {itemRemoveVariant === 'icon' ? '×' : 'Remove'}
      </button>
    ) : null;

  return (
    <section
      style={{
        display: 'grid',
        gap: space.md,
        minWidth: 0,
        ...hierarchyStyle(depth, isItem),
      }}
    >
      {isItem ? (
        <>
          <div style={itemMetaStyle}>
            <span style={itemLabelStyle}>{`Item ${String(itemIndex + 1).padStart(2, '0')}`}</span>
            {itemRemovePlacement === 'header' ? removeButton : null}
          </div>
          <div
            style={
              itemRemovePlacement === 'inline'
                ? {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: space.md,
                    minWidth: 0,
                  }
                : undefined
            }
          >
            <div style={{ ...layoutStyle, minWidth: 0, flex: 1 }}>{children}</div>
            {itemRemovePlacement === 'inline' ? removeButton : null}
          </div>
        </>
      ) : (
        <div style={headingStyle}>
          <div style={titleStyle}>{title}</div>
          {description ? <div style={textStyle}>{description}</div> : null}
        </div>
      )}
      {!isItem ? <div style={layoutStyle}>{children}</div> : null}
    </section>
  );
}
