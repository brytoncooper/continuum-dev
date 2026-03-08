import { createContext, useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { color, control, radius, space, type } from './tokens.js';

export type StarterKitStyleSlot =
  | 'fieldControl'
  | 'sliderInput'
  | 'actionButton'
  | 'collectionAddButton'
  | 'itemRemoveButton'
  | 'itemIconRemoveButton'
  | 'conflictActionButton'
  | 'suggestionsActionButton';

export type StarterKitStyleConfig = Partial<Record<StarterKitStyleSlot, CSSProperties>>;

export const starterKitDefaultStyles: Record<StarterKitStyleSlot, CSSProperties> = {
  fieldControl: {
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    height: control.height,
    padding: `${control.paddingY}px ${control.paddingX}px`,
    borderRadius: radius.md,
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    outline: 'none',
    ...type.body,
  },
  sliderInput: {
    boxSizing: 'border-box',
    width: '100%',
    margin: 0,
    accentColor: color.accent,
  },
  actionButton: {
    boxSizing: 'border-box',
    height: control.height,
    padding: `0 ${space.lg}px`,
    borderRadius: radius.md,
    border: `1px solid ${color.borderStrong}`,
    background: color.accent,
    color: color.surface,
    fontFamily: 'inherit',
    cursor: 'pointer',
    justifySelf: 'end',
    ...type.body,
    fontWeight: 600,
  },
  collectionAddButton: {
    boxSizing: 'border-box',
    height: control.height,
    margin: 0,
    padding: `0 ${space.md}px`,
    borderRadius: radius.md,
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    cursor: 'pointer',
    flexShrink: 0,
  },
  itemRemoveButton: {
    boxSizing: 'border-box',
    height: control.height,
    margin: 0,
    padding: `0 ${space.md}px`,
    borderRadius: radius.md,
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  itemIconRemoveButton: {
    boxSizing: 'border-box',
    width: control.height,
    height: control.height,
    margin: 0,
    padding: 0,
    borderRadius: radius.md,
    border: `1px solid ${color.border}`,
    background: color.surface,
    color: color.text,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...type.section,
  },
  conflictActionButton: {
    boxSizing: 'border-box',
    ...type.small,
    color: color.text,
    padding: `${space.sm}px ${space.md}px`,
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    background: color.surface,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  suggestionsActionButton: {
    boxSizing: 'border-box',
    ...type.small,
    color: color.text,
    padding: `${space.sm}px ${space.md}px`,
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    background: color.surfaceMuted,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
};

const StarterKitStyleContext = createContext<StarterKitStyleConfig>({});

export function StarterKitStyleProvider({
  children,
  styles,
}: {
  children: ReactNode;
  styles?: StarterKitStyleConfig;
}) {
  return (
    <StarterKitStyleContext.Provider value={styles ?? {}}>
      {children}
    </StarterKitStyleContext.Provider>
  );
}

export function useStarterKitStyle(
  slot: StarterKitStyleSlot,
  baseStyle: CSSProperties
): CSSProperties {
  const styles = useContext(StarterKitStyleContext);
  const override = styles[slot];

  if (!override) {
    return baseStyle;
  }

  return {
    ...baseStyle,
    ...override,
  };
}
