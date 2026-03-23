import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export type AnchoredPopupLayout = {
  placement: 'up' | 'down';
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

export type AnchoredPopupOptions = {
  preferredHeight?: number;
  minimumHeight?: number;
  gap?: number;
  viewportPadding?: number;
  minimumWidth?: number;
};

const defaultOptions: Required<AnchoredPopupOptions> = {
  preferredHeight: 280,
  minimumHeight: 120,
  gap: 8,
  viewportPadding: 12,
  minimumWidth: 0,
};

const useSafeLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

function resolvePopoverHeight(
  spaceAvailable: number,
  options: Required<AnchoredPopupOptions>
) {
  const safeSpace = Math.max(spaceAvailable, 0);
  return Math.max(
    Math.min(options.preferredHeight, safeSpace),
    Math.min(options.minimumHeight, safeSpace)
  );
}

export function measureAnchoredPopupLayout(
  rect: DOMRect,
  options?: AnchoredPopupOptions
): AnchoredPopupLayout {
  const resolved = {
    ...defaultOptions,
    ...options,
  };
  const viewportWidth =
    typeof window === 'undefined' ? rect.width : window.innerWidth;
  const viewportHeight =
    typeof window === 'undefined' ? rect.height : window.innerHeight;
  const availableBelow = Math.max(
    viewportHeight - rect.bottom - resolved.gap - resolved.viewportPadding,
    0
  );
  const availableAbove = Math.max(
    rect.top - resolved.gap - resolved.viewportPadding,
    0
  );
  const placement =
    availableBelow < resolved.minimumHeight && availableAbove > availableBelow
      ? 'up'
      : 'down';
  const preferredWidth = Math.max(rect.width, resolved.minimumWidth);
  const width = Math.min(
    preferredWidth,
    viewportWidth - resolved.viewportPadding * 2
  );
  const left = Math.min(
    Math.max(resolved.viewportPadding, rect.left),
    viewportWidth - width - resolved.viewportPadding
  );
  const maxHeight = resolvePopoverHeight(
    placement === 'down' ? availableBelow : availableAbove,
    resolved
  );

  if (placement === 'up') {
    return {
      placement,
      left,
      width,
      maxHeight,
      bottom: viewportHeight - rect.top + resolved.gap,
    };
  }

  return {
    placement,
    left,
    width,
    maxHeight,
    top: rect.bottom + resolved.gap,
  };
}

export function useAnchoredPopupLayout({
  open,
  isCompact,
  anchorRef,
  options,
}: {
  open: boolean;
  isCompact: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  options?: AnchoredPopupOptions;
}): AnchoredPopupLayout | null {
  const [layout, setLayout] = useState<AnchoredPopupLayout | null>(null);

  useSafeLayoutEffect(() => {
    if (
      !open ||
      isCompact ||
      typeof window === 'undefined' ||
      anchorRef.current === null
    ) {
      setLayout(null);
      return;
    }

    const updateLayout = () => {
      if (!anchorRef.current) {
        return;
      }

      setLayout(
        measureAnchoredPopupLayout(
          anchorRef.current.getBoundingClientRect(),
          options
        )
      );
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);

    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [anchorRef, isCompact, open, options]);

  return layout;
}
