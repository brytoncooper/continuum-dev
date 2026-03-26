import type { CSSProperties, ReactNode } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { color, radius, space, type } from '../../tokens.js';
import {
  starterKitDefaultStyles,
  useStarterKitStyle,
} from '../../style-config.js';
import { streamedNodeMotionStyle } from './motion.js';
import { nodeDepth } from './node.js';

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
  minHeight: 28,
};

const itemLabelStyle: CSSProperties = {
  ...type.label,
  color: color.textSoft,
};

function useStreamingContainerMotion({
  nodeId,
  enabled,
}: {
  nodeId?: string;
  enabled: boolean;
}) {
  const shellRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedInRef = useRef(false);
  const cleanupTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTargetHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = shellRef.current;
    const content = contentRef.current;

    if (
      !enabled ||
      !element ||
      !content ||
      typeof window === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    ) {
      return;
    }

    const clearCleanupTimeout = () => {
      if (cleanupTimeoutRef.current !== null) {
        window.clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
    };

    const settleHeight = () => {
      element.style.height = 'auto';
      element.style.overflow = 'visible';
      element.style.willChange = 'auto';
    };

    const scheduleSettleHeight = () => {
      clearCleanupTimeout();
      cleanupTimeoutRef.current = window.setTimeout(() => {
        settleHeight();
        cleanupTimeoutRef.current = null;
      }, 340);
    };

    const readContainerChromeHeight = () => {
      const styles = window.getComputedStyle(element);

      return (
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom) +
        Number.parseFloat(styles.borderTopWidth) +
        Number.parseFloat(styles.borderBottomWidth)
      );
    };

    const animateHeight = (toHeight: number, force = false) => {
      const currentHeight = element.getBoundingClientRect().height;

      if (
        !force &&
        lastTargetHeightRef.current !== null &&
        Math.abs(lastTargetHeightRef.current - toHeight) < 1
      ) {
        return;
      }

      if (Math.abs(toHeight - currentHeight) < 1) {
        lastTargetHeightRef.current = toHeight;
        settleHeight();
        return;
      }

      lastTargetHeightRef.current = toHeight;
      element.style.height = `${currentHeight}px`;
      element.style.overflow = 'clip';
      element.style.willChange = 'opacity, height';
      void element.getBoundingClientRect();
      element.style.height = `${toHeight}px`;
      scheduleSettleHeight();
    };

    const syncToContentHeight = (force = false) => {
      const targetHeight =
        content.getBoundingClientRect().height + readContainerChromeHeight();
      animateHeight(targetHeight, force);
    };

    element.style.transition =
      'opacity 220ms cubic-bezier(0.2, 0.72, 0.18, 1), height 320ms cubic-bezier(0.2, 0.72, 0.18, 1)';

    const observer = new ResizeObserver(() => {
      if (!hasAnimatedInRef.current) {
        return;
      }

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = window.requestAnimationFrame(() => {
        syncToContentHeight();
      });
    });

    observer.observe(content);

    if (!hasAnimatedInRef.current) {
      element.style.opacity = '0';
      element.style.height = '0px';
      element.style.overflow = 'clip';

      rafRef.current = window.requestAnimationFrame(() => {
        element.style.opacity = '1';
        syncToContentHeight(true);
        hasAnimatedInRef.current = true;
      });
    }

    return () => {
      observer.disconnect();
      clearCleanupTimeout();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, nodeId]);

  return { shellRef, contentRef };
}

function hierarchyStyle(depth: number, isItem: boolean): CSSProperties {
  if (isItem) {
    return {
      padding: space.sm + 2,
      borderRadius: radius.md,
      background: color.surface,
      border: `1px solid ${color.borderSoft}`,
    };
  }

  if (depth === 0) {
    return {
      padding: space.md,
      borderRadius: radius.md,
      background: color.surface,
      border: `1px solid ${color.borderSoft}`,
    };
  }

  return {
    paddingLeft: depth === 1 ? space.md : space.sm,
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
  title?: string;
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
  const { shellRef, contentRef } = useStreamingContainerMotion({
    nodeId,
    enabled: isItem || depth <= 1,
  });
  const removeButtonStyle = useStarterKitStyle(
    'itemRemoveButton',
    starterKitDefaultStyles.itemRemoveButton
  );
  const iconRemoveButtonStyle = useStarterKitStyle(
    'itemIconRemoveButton',
    starterKitDefaultStyles.itemIconRemoveButton
  );
  const contentGap = isItem ? space.sm : space.md;

  const removeButton = canRemove ? (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove item"
      style={
        itemRemoveVariant === 'icon' ? iconRemoveButtonStyle : removeButtonStyle
      }
    >
      {itemRemoveVariant === 'icon' ? 'x' : 'Remove'}
    </button>
  ) : null;

  return (
    <section
      ref={shellRef}
      data-continuum-animated="container"
      data-continuum-node-shell="true"
      data-continuum-node-id={nodeId}
      style={{
        minWidth: 0,
        opacity: 1,
        height: 'auto',
        ...streamedNodeMotionStyle(nodeId, 'shell'),
        ...hierarchyStyle(depth, isItem),
      }}
    >
      <div
        ref={contentRef}
        style={{
          display: 'grid',
          gap: contentGap,
          minWidth: 0,
        }}
      >
        {isItem ? (
          <>
            <div
              data-continuum-animated-child="meta"
              style={{
                ...itemMetaStyle,
                ...streamedNodeMotionStyle(nodeId, 'content'),
              }}
            >
              <span style={itemLabelStyle}>{`Item ${String(
                itemIndex + 1
              ).padStart(2, '0')}`}</span>
              {itemRemovePlacement === 'header' ? removeButton : null}
            </div>
            <div
              data-continuum-animated-child="content"
              style={
                itemRemovePlacement === 'inline'
                  ? {
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'flex-end',
                      gap: space.md,
                      minWidth: 0,
                      ...streamedNodeMotionStyle(nodeId, 'content'),
                    }
                  : streamedNodeMotionStyle(nodeId, 'content')
              }
            >
              <div style={{ ...layoutStyle, minWidth: 0, flex: 1 }}>
                {children}
              </div>
              {itemRemovePlacement === 'inline' ? removeButton : null}
            </div>
          </>
        ) : (
          <>
            {title || description ? (
              <div
                data-continuum-animated-child="heading"
                style={{
                  ...headingStyle,
                  ...streamedNodeMotionStyle(nodeId, 'content'),
                }}
              >
                {title ? <div style={titleStyle}>{title}</div> : null}
                {description ? (
                  <div style={textStyle}>{description}</div>
                ) : null}
              </div>
            ) : null}
            <div
              data-continuum-animated-child="content"
              style={{
                ...layoutStyle,
                ...streamedNodeMotionStyle(nodeId, 'content'),
              }}
            >
              {children}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
