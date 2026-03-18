import type { FieldOption, NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { color, control, radius, shadow, space, type as typeScale } from '../../tokens.js';
import { FieldFrame, useInputLikeStyle } from '../shared/field-frame.js';
import { useAnchoredPopupLayout } from '../shared/anchored-popup.js';
import { PopupPortal } from '../shared/popup-portal.js';
import {
  compactFieldControlStyle,
  useCompactViewport,
} from '../shared/responsive-layout.js';
import {
  nodeDescription,
  nodeLabel,
  nodeOptionKey,
  nodeOptions,
  nodePlaceholder,
  readNodeProp,
} from '../shared/node.js';

const triggerTextStyle: CSSProperties = {
  minWidth: 0,
  textAlign: 'left',
};

const popoverBaseStyle: CSSProperties = {
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
  boxShadow: '0 18px 44px rgba(17, 17, 17, 0.16)',
};

const popupOverlayZIndex = 4000;
const popupContentZIndex = 4001;
const desktopViewportPadding = space.md;
const desktopPreferredPopoverHeight = 280;
const selectPopupOptions = {
  preferredHeight: desktopPreferredPopoverHeight,
  minimumHeight: 120,
  gap: space.sm,
  viewportPadding: desktopViewportPadding,
};

function clampIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), total - 1);
}

function selectedIndexForValue(options: FieldOption[], selected: string): number {
  const index = options.findIndex((option) => option.value === selected);
  return index >= 0 ? index : 0;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 8"
      width="12"
      height="8"
      style={{
        flexShrink: 0,
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 180ms ease',
      }}
    >
      <path
        d="M1 1.25 6 6.25l5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function selectionBadgeStyle(selected: boolean): CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    border: `1px solid ${selected ? color.borderStrong : color.border}`,
    background: selected ? color.accent : color.surface,
    boxShadow: selected ? `inset 0 0 0 4px ${color.surface}` : 'none',
    flexShrink: 0,
  };
}

function optionButtonStyle(
  selected: boolean,
  highlighted: boolean,
  isCompact: boolean
): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    minWidth: 0,
    padding: `${isCompact ? space.md : space.sm}px ${space.md}px`,
    border: `1px solid ${
      selected ? color.borderStrong : highlighted ? color.border : color.borderSoft
    }`,
    borderRadius: radius.md,
    background: selected ? color.surfaceMuted : color.surface,
    color: color.text,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: highlighted ? shadow.panel : 'none',
  };
}

export function SelectInput({
  value,
  onChange,
  definition,
  nodeId,
  hasSuggestion,
  suggestionValue,
}: ContinuumNodeProps) {
  const nodeValue = value as NodeValue<string> | undefined;
  const isCompact = useCompactViewport();
  const label = nodeLabel(definition);
  const description = nodeDescription(definition);
  const placeholder = nodePlaceholder(definition) ?? 'Select one';
  const options = nodeOptions(definition);
  const selected =
    nodeValue?.value ??
    readNodeProp<string>(definition, 'defaultValue') ??
    '';
  const readOnly = Boolean(readNodeProp<boolean>(definition, 'readOnly'));
  const disabled = readOnly || options.length === 0;
  const selectedOption = options.find((option) => option.value === selected);
  const selectedLabel = selectedOption?.label ?? (selected ? selected : placeholder);
  const selectedIndex = selectedIndexForValue(options, selected);
  const triggerId = useId();
  const labelId = useId();
  const valueId = useId();
  const descriptionId = useId();
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const desktopPopoverLayout = useAnchoredPopupLayout({
    open,
    isCompact,
    anchorRef: buttonRef,
    options: selectPopupOptions,
  });

  const triggerStyle = {
    ...useInputLikeStyle(),
    ...compactFieldControlStyle(isCompact),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: isCompact ? control.height + space.xs : control.height,
    height: isCompact ? control.height + space.xs : control.height,
    padding: isCompact
      ? `${space.md}px ${control.paddingX}px`
      : `${control.paddingY}px ${control.paddingX}px`,
    textAlign: 'left' as const,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.72 : 1,
    background: open ? color.surfaceMuted : color.surface,
    borderColor: open ? color.borderStrong : color.border,
    boxShadow: open ? '0 0 0 1px rgba(17, 17, 17, 0.06)' : shadow.panel,
    position: 'relative' as const,
    zIndex: open ? 22 : 1,
  };

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(selectedIndex);
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || (!isCompact && !desktopPopoverLayout)) {
      return;
    }

    optionRefs.current[highlightedIndex]?.focus();
  }, [desktopPopoverLayout, highlightedIndex, isCompact, open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        window.setTimeout(() => buttonRef.current?.focus(), 0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || !isCompact || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCompact, open]);

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => buttonRef.current?.focus(), 0);
    }
  };

  const openMenu = (index = selectedIndex) => {
    if (disabled) {
      return;
    }

    setHighlightedIndex(clampIndex(index, options.length));
    setOpen(true);
  };

  const desktopPopoverStyle =
    !isCompact && desktopPopoverLayout
      ? {
          ...popoverBaseStyle,
          position: 'fixed' as const,
          left: desktopPopoverLayout.left,
          width: desktopPopoverLayout.width,
          maxHeight: desktopPopoverLayout.maxHeight,
          zIndex: popupContentZIndex,
          display: 'grid',
          gap: space.sm,
          padding: space.sm,
          top: desktopPopoverLayout.top,
          bottom: desktopPopoverLayout.bottom,
        }
      : null;

  const commitValue = (nextValue: string) => {
    onChange({ value: nextValue, isDirty: true } as NodeValue);
    closeMenu(true);
  };

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(selectedIndex + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(selectedIndex - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  };

  const handleOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => clampIndex(current + 1, options.length));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => clampIndex(current - 1, options.length));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(options.length - 1);
      return;
    }

    if (event.key === 'Tab') {
      window.setTimeout(() => setOpen(false), 0);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitValue(options[index]?.value ?? '');
    }
  };

  return (
    <FieldFrame
      as="div"
      nodeId={nodeId}
      label={label}
      labelId={label ? labelId : undefined}
      description={description}
      descriptionId={description ? descriptionId : undefined}
      hasSuggestion={Boolean(hasSuggestion)}
      suggestionValue={suggestionValue}
      currentValue={nodeValue?.value}
      onAcceptSuggestion={() => {
        if (suggestionValue === undefined) {
          return;
        }
        onChange({
          ...(nodeValue ?? {}),
          value: suggestionValue,
          suggestion: undefined,
          isDirty: true,
        } as NodeValue);
      }}
      onRejectSuggestion={() => {
        if (!nodeValue) {
          return;
        }
        onChange({
          ...nodeValue,
          suggestion: undefined,
        } as NodeValue);
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          id={triggerId}
          type="button"
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
          aria-describedby={description ? descriptionId : undefined}
          data-continuum-control="true"
          data-continuum-node-id={nodeId}
          disabled={disabled}
          style={triggerStyle}
          onClick={() => {
            if (open) {
              closeMenu();
              return;
            }

            openMenu();
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <span style={triggerTextStyle}>
            <span
              id={valueId}
              style={{
                ...typeScale.body,
                color: selectedOption ? color.text : color.textMuted,
                fontWeight: selectedOption ? 600 : 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selectedLabel}
            </span>
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              background: open ? color.surface : color.surfaceMuted,
              color: color.textSoft,
              border: `1px solid ${open ? color.border : color.borderSoft}`,
            }}
          >
            <ChevronIcon open={open} />
          </span>
        </button>

        {open ? (
          <PopupPortal>
            <>
              <div
                aria-hidden="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: isCompact ? 'rgba(17, 17, 17, 0.16)' : 'transparent',
                  zIndex: popupOverlayZIndex,
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  closeMenu();
                }}
              />
              {isCompact || desktopPopoverStyle ? (
                <div
                  data-continuum-select-popup="true"
                  data-continuum-select-placement={
                    isCompact ? 'sheet' : desktopPopoverLayout?.placement ?? 'down'
                  }
                  style={
                    isCompact
                      ? {
                          ...popoverBaseStyle,
                          position: 'fixed',
                          insetInline: space.md,
                          bottom: space.md,
                          zIndex: popupContentZIndex,
                          display: 'grid',
                          gap: space.md,
                          padding: space.md,
                          maxHeight: 'min(70vh, 420px)',
                          overflowY: 'auto',
                          overflowX: 'hidden',
                        }
                      : desktopPopoverStyle
                  }
                >
                  {isCompact ? (
                    <div style={{ display: 'grid', gap: 2 }}>
                      <span style={{ ...typeScale.section, color: color.text }}>
                        {label ?? 'Choose an option'}
                      </span>
                      <span style={{ ...typeScale.small, color: color.textMuted }}>
                        Tap an option to update this field.
                      </span>
                    </div>
                  ) : null}
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-labelledby={label ? labelId : triggerId}
                    style={{
                      display: 'grid',
                      gap: space.xs,
                      maxHeight: isCompact
                        ? 'min(52vh, 360px)'
                        : desktopPopoverLayout?.maxHeight ?? desktopPreferredPopoverHeight,
                      overflowY: 'auto',
                    }}
                  >
                    {options.map((option, index) => {
                      const isSelected = option.value === selected;
                      const isHighlighted = index === highlightedIndex;

                      return (
                        <button
                          key={nodeOptionKey(option, index)}
                          ref={(element) => {
                            optionRefs.current[index] = element;
                          }}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-continuum-control="true"
                          data-continuum-node-id={nodeId}
                          style={optionButtonStyle(isSelected, isHighlighted, isCompact)}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => commitValue(option.value)}
                          onKeyDown={(event) => handleOptionKeyDown(event, index)}
                        >
                          <span aria-hidden="true" style={selectionBadgeStyle(isSelected)} />
                          <span
                            style={{
                              ...typeScale.body,
                              color: color.text,
                              fontWeight: isSelected ? 600 : 400,
                              minWidth: 0,
                            }}
                          >
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selected ? (
                    <button
                      type="button"
                      style={{
                        ...typeScale.small,
                        justifySelf: 'start',
                        padding: `${space.sm}px ${space.md}px`,
                        borderRadius: radius.pill,
                        border: `1px solid ${color.border}`,
                        background: color.surfaceMuted,
                        color: color.text,
                        cursor: 'pointer',
                      }}
                      onClick={() => commitValue('')}
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          </PopupPortal>
        ) : null}
      </div>
    </FieldFrame>
  );
}
