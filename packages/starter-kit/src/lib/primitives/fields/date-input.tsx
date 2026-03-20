import type { NodeValue } from '@continuum-dev/contract';
import type { ContinuumNodeProps } from '@continuum-dev/react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  color,
  control,
  radius,
  shadow,
  space,
  type as typeScale,
} from '../../tokens.js';
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
  nodePlaceholder,
  readNodeProp,
} from '../shared/node.js';

const popoverBaseStyle: CSSProperties = {
  borderRadius: radius.lg,
  border: `1px solid ${color.border}`,
  background: color.surface,
  boxShadow: '0 18px 44px rgba(17, 17, 17, 0.16)',
};

const popupOverlayZIndex = 4000;
const popupContentZIndex = 4001;
const desktopViewportPadding = space.md;
const datePopupOptions = {
  preferredHeight: 404 + space.lg,
  minimumHeight: 320,
  gap: space.sm,
  viewportPadding: desktopViewportPadding,
  minimumWidth: 420,
};

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const triggerFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
});

const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
  weekdayFormatter.format(new Date(2026, 0, 4 + index, 12))
);

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: monthLabelFormatter.format(new Date(2026, index, 1, 12)),
}));

const monthIndexLookup: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

type PickerView = 'days' | 'months' | 'years';

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 12);
}

function normalizeDate(date: Date): Date {
  return createDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function createValidatedDate(year: number, month: number, day: number): Date | null {
  const date = createDate(year, month, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseIsoDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return createValidatedDate(year, month, day);
}

function resolveTypedYear(year: string | undefined, referenceDate: Date): number {
  if (!year) {
    return referenceDate.getFullYear();
  }

  const numericYear = Number(year);
  if (year.length <= 2) {
    return numericYear >= 70 ? 1900 + numericYear : 2000 + numericYear;
  }

  return numericYear;
}

function resolveMonthToken(token: string): number | null {
  return monthIndexLookup[token] ?? null;
}

function parseFlexibleDateInput(value: string, referenceDate: Date): Date | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'today') {
    return referenceDate;
  }

  if (normalized === 'tomorrow') {
    return addDays(referenceDate, 1);
  }

  if (normalized === 'yesterday') {
    return addDays(referenceDate, -1);
  }

  if (/^\d{8}$/.test(normalized)) {
    if (/^(19|20)\d{6}$/.test(normalized)) {
      return createValidatedDate(
        Number(normalized.slice(0, 4)),
        Number(normalized.slice(4, 6)) - 1,
        Number(normalized.slice(6, 8))
      );
    }

    const first = Number(normalized.slice(0, 2));
    const second = Number(normalized.slice(2, 4));
    const year = Number(normalized.slice(4, 8));
    return first > 12 && second <= 12
      ? createValidatedDate(year, second - 1, first)
      : createValidatedDate(year, first - 1, second);
  }

  if (/^\d{6}$/.test(normalized)) {
    const first = Number(normalized.slice(0, 2));
    const second = Number(normalized.slice(2, 4));
    const year = resolveTypedYear(normalized.slice(4, 6), referenceDate);
    return first > 12 && second <= 12
      ? createValidatedDate(year, second - 1, first)
      : createValidatedDate(year, first - 1, second);
  }

  let match = /^(\d{4})[-/ ](\d{1,2})[-/ ](\d{1,2})$/.exec(normalized);
  if (match) {
    return createValidatedDate(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  match = /^(\d{1,2})[-/ ](\d{1,2})(?:[-/ ](\d{2,4}))?$/.exec(normalized);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = resolveTypedYear(match[3], referenceDate);

    if (first > 12 && second <= 12) {
      return createValidatedDate(year, second - 1, first);
    }

    if (second > 12 && first <= 12) {
      return createValidatedDate(year, first - 1, second);
    }

    return createValidatedDate(year, first - 1, second);
  }

  match = /^([a-z]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?$/.exec(normalized);
  if (match) {
    const month = resolveMonthToken(match[1]);
    if (month !== null) {
      return createValidatedDate(
        resolveTypedYear(match[3], referenceDate),
        month,
        Number(match[2])
      );
    }
  }

  match = /^(\d{1,2})\s+([a-z]+)(?:\s+(\d{2,4}))?$/.exec(normalized);
  if (match) {
    const month = resolveMonthToken(match[2]);
    if (month !== null) {
      return createValidatedDate(
        resolveTypedYear(match[3], referenceDate),
        month,
        Number(match[1])
      );
    }
  }

  if (/[a-z]/.test(normalized)) {
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return normalizeDate(parsedDate);
    }
  }

  return null;
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;
}

function sameDay(left: Date | null, right: Date | null): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfMonth(date: Date): Date {
  return createDate(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, amount: number): Date {
  return createDate(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function daysInMonth(date: Date): number {
  return createDate(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addMonths(date: Date, amount: number): Date {
  const targetMonth = createDate(date.getFullYear(), date.getMonth() + amount, 1);
  return createDate(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), daysInMonth(targetMonth))
  );
}

function addYears(date: Date, amount: number): Date {
  return addMonths(date, amount * 12);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function buildCalendarDays(viewDate: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(viewDate));
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function yearGridStart(date: Date): number {
  return date.getFullYear() - 5;
}

function chipButtonStyle(isCompact: boolean): CSSProperties {
  return {
    ...typeScale.small,
    width: '100%',
    minHeight: isCompact ? 40 : 36,
    padding: `${isCompact ? space.sm : space.xs}px ${space.md}px`,
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    background: color.surfaceMuted,
    color: color.text,
    cursor: 'pointer',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };
}

function headerButtonStyle(): CSSProperties {
  return {
    ...typeScale.section,
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.xs,
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: color.text,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

function navButtonStyle(isCompact: boolean): CSSProperties {
  return {
    width: isCompact ? 36 : 34,
    height: isCompact ? 36 : 34,
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    background: color.surfaceMuted,
    color: color.text,
    cursor: 'pointer',
    flexShrink: 0,
  };
}

function selectorButtonStyle(selected: boolean, isCompact: boolean): CSSProperties {
  return {
    ...typeScale.body,
    width: '100%',
    minHeight: isCompact ? 44 : 40,
    padding: `${isCompact ? space.sm : space.xs}px ${space.md}px`,
    borderRadius: radius.md,
    border: `1px solid ${selected ? color.borderStrong : color.borderSoft}`,
    background: selected ? color.surfaceMuted : color.surface,
    color: color.text,
    cursor: 'pointer',
    fontWeight: selected ? 600 : 500,
    textAlign: 'center',
  };
}

function dayButtonStyle({
  isSelected,
  isToday,
  isCurrentMonth,
  isCompact,
}: {
  isSelected: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  isCompact: boolean;
}): CSSProperties {
  const size = isCompact ? 40 : 36;

  if (isSelected) {
    return {
      width: size,
      height: size,
      borderRadius: radius.pill,
      border: `1px solid ${color.borderStrong}`,
      background: color.accent,
      color: color.surface,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...typeScale.body,
      fontWeight: 600,
    };
  }

  return {
    width: size,
    height: size,
    borderRadius: radius.pill,
    border: '1px solid transparent',
    background: isCurrentMonth ? color.surface : color.surfaceMuted,
    color: isCurrentMonth ? color.text : color.textSoft,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...typeScale.body,
    fontWeight: isToday ? 600 : 500,
  };
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
      <path
        d="M4.5 1.75v2.5M11.5 1.75v2.5M2 5.25h12M3.75 3.25h8.5A1.75 1.75 0 0 1 14 5v7.25A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25V5A1.75 1.75 0 0 1 3.75 3.25Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' | 'down' }) {
  const path =
    direction === 'left'
      ? 'M7.5 2.25 4 6l3.5 3.75'
      : direction === 'right'
      ? 'M4.5 2.25 8 6 4.5 9.75'
      : 'M2.25 4.5 6 8l3.75-3.5';

  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="12" height="12">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function DateInput({
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
  const placeholder = nodePlaceholder(definition) ?? 'Select date';
  const readOnly = Boolean(readNodeProp<boolean>(definition, 'readOnly'));
  const dateValue =
    nodeValue?.value ??
    readNodeProp<string>(definition, 'defaultValue') ??
    '';
  const selectedDate = parseIsoDate(dateValue);
  const [today] = useState(() => normalizeDate(new Date()));
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dayButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [open, setOpen] = useState(false);
  const [pickerView, setPickerView] = useState<PickerView>('days');
  const [viewDate, setViewDate] = useState(() =>
    startOfMonth(selectedDate ?? today)
  );
  const [highlightedDate, setHighlightedDate] = useState<Date>(
    selectedDate ?? today
  );
  const [typedDateValue, setTypedDateValue] = useState(dateValue);
  const [typedDateError, setTypedDateError] = useState<string | null>(null);
  const desktopPopoverLayout = useAnchoredPopupLayout({
    open,
    isCompact,
    anchorRef: buttonRef,
    options: datePopupOptions,
  });
  const triggerId = useId();
  const labelId = useId();
  const valueId = useId();
  const descriptionId = useId();
  const dialogId = useId();
  const displayedDate = selectedDate ? triggerFormatter.format(selectedDate) : placeholder;
  const calendarDays = buildCalendarDays(viewDate);
  const currentYearRangeStart = yearGridStart(viewDate);
  const disabled = readOnly;
  const popupSectionGap = isCompact ? space.md : space.sm;
  const popupPadding = isCompact ? space.md : space.sm;
  const inlineInputHeight = isCompact ? 40 : 38;
  const helperTextVisible = isCompact || Boolean(typedDateError);
  const bottomButtonSpacing = space.lg;
  const desktopPopupTargetHeight =
    (pickerView === 'days'
      ? typedDateError
        ? 424
        : 404
      : typedDateError
      ? 356
      : 336) +
    bottomButtonSpacing;
  const desktopPopupShouldScroll = Boolean(
    desktopPopoverLayout &&
      desktopPopoverLayout.maxHeight < desktopPopupTargetHeight
  );

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

  const inlineInputStyle = {
    ...useInputLikeStyle({
      height: inlineInputHeight,
      minHeight: inlineInputHeight,
      padding: `${isCompact ? space.sm : space.xs}px ${control.paddingX}px`,
    }),
    fontSize: 14,
  };

  const desktopPopoverStyle =
    !isCompact && desktopPopoverLayout
      ? {
          ...popoverBaseStyle,
          position: 'fixed' as const,
          left: desktopPopoverLayout.left,
          width: desktopPopoverLayout.width,
          height: Math.min(
            desktopPopoverLayout.maxHeight,
            desktopPopupTargetHeight
          ),
          maxHeight: desktopPopoverLayout.maxHeight,
          zIndex: popupContentZIndex,
          display: 'grid',
          gap: popupSectionGap,
          padding: popupPadding,
          paddingBottom: popupPadding + bottomButtonSpacing,
          top: desktopPopoverLayout.top,
          bottom: desktopPopoverLayout.bottom,
          overflowY: desktopPopupShouldScroll ? ('auto' as const) : ('hidden' as const),
          overflowX: 'hidden' as const,
        }
      : null;

  useEffect(() => {
    if (!open) {
      const fallback = selectedDate ?? today;
      setViewDate(startOfMonth(fallback));
      setHighlightedDate(fallback);
      setTypedDateValue(dateValue);
      setTypedDateError(null);
      setPickerView('days');
    }
  }, [
    dateValue,
    open,
    selectedDate?.getFullYear(),
    selectedDate?.getMonth(),
    selectedDate?.getDate(),
    today,
  ]);

  useEffect(() => {
    if (
      !open ||
      pickerView !== 'days' ||
      (!isCompact && !desktopPopoverLayout)
    ) {
      return;
    }

    const highlightedId = formatIsoDate(highlightedDate);
    dayButtonRefs.current[highlightedId]?.focus();
  }, [desktopPopoverLayout, highlightedDate, isCompact, open, pickerView]);

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

  const closePicker = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => buttonRef.current?.focus(), 0);
    }
  };

  const syncVisibleDate = (nextDate: Date) => {
    const normalized = normalizeDate(nextDate);
    setHighlightedDate(normalized);
    setViewDate(startOfMonth(normalized));
    setTypedDateError(null);
  };

  const commitDate = (nextDate: Date | null) => {
    setTypedDateValue(nextDate ? formatIsoDate(nextDate) : '');
    setTypedDateError(null);
    onChange({
      value: nextDate ? formatIsoDate(nextDate) : '',
      isDirty: true,
    } as NodeValue);
    closePicker(true);
  };

  const openPicker = () => {
    if (disabled) {
      return;
    }

    const fallback = selectedDate ?? today;
    setPickerView('days');
    setViewDate(startOfMonth(fallback));
    setHighlightedDate(fallback);
    setTypedDateValue(dateValue);
    setTypedDateError(null);
    setOpen(true);
  };

  const applyTypedDate = () => {
    const nextValue = typedDateValue.trim();
    if (nextValue.length === 0) {
      commitDate(null);
      return;
    }

    const parsedDate = parseFlexibleDateInput(nextValue, today);
    if (!parsedDate) {
      setTypedDateError('Try 4/21/2030, Apr 21 2030, or today');
      return;
    }

    syncVisibleDate(parsedDate);
    commitDate(parsedDate);
  };

  const handleHeaderStep = (amount: number) => {
    if (pickerView === 'years') {
      const nextDate = addYears(viewDate, amount * 12);
      setViewDate(startOfMonth(nextDate));
      return;
    }

    if (pickerView === 'months') {
      const nextDate = addYears(viewDate, amount);
      setViewDate(startOfMonth(nextDate));
      return;
    }

    syncVisibleDate(addMonths(highlightedDate, amount));
  };

  const handleDayKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    day: Date
  ) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      syncVisibleDate(addDays(day, 1));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      syncVisibleDate(addDays(day, -1));
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      syncVisibleDate(addDays(day, 7));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      syncVisibleDate(addDays(day, -7));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      syncVisibleDate(startOfWeek(day));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      syncVisibleDate(endOfWeek(day));
      return;
    }

    if (event.key === 'PageDown') {
      event.preventDefault();
      syncVisibleDate(addMonths(day, 1));
      return;
    }

    if (event.key === 'PageUp') {
      event.preventDefault();
      syncVisibleDate(addMonths(day, -1));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitDate(day);
      return;
    }

    if (event.key === 'Tab') {
      window.setTimeout(() => setOpen(false), 0);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
    }
  };

  const headerTitle =
    pickerView === 'years'
      ? `${currentYearRangeStart} - ${currentYearRangeStart + 11}`
      : pickerView === 'months'
      ? `${viewDate.getFullYear()}`
      : monthFormatter.format(viewDate);

  const headerSubtitle =
    pickerView === 'days'
      ? selectedDate
        ? longDateFormatter.format(selectedDate)
        : 'Choose a date from the calendar'
      : pickerView === 'months'
      ? 'Choose a month'
      : 'Choose a year';

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
          aria-haspopup="dialog"
          aria-controls={open ? dialogId : undefined}
          aria-expanded={open}
          aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
          aria-describedby={description ? descriptionId : undefined}
          data-continuum-control="true"
          data-continuum-node-id={nodeId}
          disabled={disabled}
          style={triggerStyle}
          onClick={() => {
            if (open) {
              closePicker();
              return;
            }

            openPicker();
          }}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            if (
              event.key === 'ArrowDown' ||
              event.key === 'Enter' ||
              event.key === ' '
            ) {
              event.preventDefault();
              openPicker();
            }
          }}
        >
          <span
            id={valueId}
            style={{
              ...typeScale.body,
              color: selectedDate ? color.text : color.textMuted,
              fontWeight: selectedDate ? 600 : 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {displayedDate}
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
              flexShrink: 0,
            }}
          >
            <CalendarIcon />
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
                  closePicker();
                }}
              />
              {isCompact || desktopPopoverStyle ? (
                <div
                  id={dialogId}
                  role="dialog"
                  aria-modal={isCompact}
                  aria-labelledby={label ? labelId : undefined}
                  data-continuum-date-popup="true"
                  data-continuum-date-placement={
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
                          gap: popupSectionGap,
                          padding: popupPadding,
                          paddingBottom: popupPadding + bottomButtonSpacing,
                          maxHeight: 'min(78vh, 560px)',
                          overflowY: 'auto',
                          overflowX: 'hidden',
                        }
                      : (desktopPopoverStyle as CSSProperties)
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: popupSectionGap,
                    }}
                  >
                    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      <button
                        type="button"
                        style={headerButtonStyle()}
                        onClick={() => {
                          if (pickerView === 'days') {
                            setPickerView('months');
                            return;
                          }

                          if (pickerView === 'months') {
                            setPickerView('years');
                          }
                        }}
                      >
                        <span>{headerTitle}</span>
                        {pickerView !== 'years' ? <ChevronIcon direction="down" /> : null}
                      </button>
                      <span style={{ ...typeScale.small, color: color.textMuted }}>
                        {headerSubtitle}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: space.xs }}>
                      <button
                        type="button"
                        aria-label="Previous"
                        style={navButtonStyle(isCompact)}
                        onClick={() => handleHeaderStep(-1)}
                      >
                        <ChevronIcon direction="left" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        style={navButtonStyle(isCompact)}
                        onClick={() => handleHeaderStep(1)}
                      >
                        <ChevronIcon direction="right" />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: isCompact ? space.sm : space.xs,
                      gridTemplateColumns: isCompact ? '1fr' : 'minmax(0, 1fr) auto',
                      alignItems: 'start',
                    }}
                  >
                    <div style={{ display: 'grid', gap: space.xs }}>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="Apr 21, 2030"
                        value={typedDateValue}
                        data-continuum-control="true"
                        data-continuum-node-id={nodeId}
                        style={inlineInputStyle}
                        onChange={(event) => {
                          setTypedDateValue(event.target.value);
                          if (typedDateError) {
                            setTypedDateError(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applyTypedDate();
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault();
                            closePicker(true);
                          }
                        }}
                      />
                      {helperTextVisible ? (
                        <span style={{ ...typeScale.small, color: color.textMuted }}>
                          {typedDateError ?? 'Try 4/21/2030, Apr 21 2030, or today.'}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      style={chipButtonStyle(isCompact)}
                      onClick={applyTypedDate}
                    >
                      Apply
                    </button>
                  </div>

                  {pickerView === 'days' ? (
                    <div style={{ display: 'grid', gap: space.xs }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                          gap: space.xs,
                        }}
                      >
                        {weekdayLabels.map((weekday) => (
                          <span
                            key={weekday}
                            style={{
                              ...typeScale.small,
                              color: color.textSoft,
                              textAlign: 'center',
                              paddingBottom: space.xs,
                            }}
                          >
                            {weekday}
                          </span>
                        ))}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                          gap: space.xs,
                          justifyItems: 'center',
                        }}
                      >
                        {calendarDays.map((day) => {
                          const isoDay = formatIsoDate(day);
                          const isSelected = sameDay(day, selectedDate);
                          const isToday = sameDay(day, today);
                          const isCurrentMonth = day.getMonth() === viewDate.getMonth();

                          return (
                            <button
                              key={isoDay}
                              ref={(element) => {
                                dayButtonRefs.current[isoDay] = element;
                              }}
                              type="button"
                              aria-label={
                                isToday
                                  ? `Today, ${longDateFormatter.format(day)}`
                                  : longDateFormatter.format(day)
                              }
                              aria-pressed={isSelected}
                              data-continuum-control="true"
                              data-continuum-node-id={nodeId}
                              style={dayButtonStyle({
                                isSelected,
                                isToday,
                                isCurrentMonth,
                                isCompact,
                              })}
                              onMouseEnter={() => setHighlightedDate(day)}
                              onClick={() => commitDate(day)}
                              onKeyDown={(event) => handleDayKeyDown(event, day)}
                            >
                              <span
                                style={{
                                  borderBottom:
                                    isToday
                                      ? `2px solid ${color.borderStrong}`
                                      : 'none',
                                  lineHeight: 1.2,
                                }}
                              >
                                {day.getDate()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {pickerView === 'months' ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: space.sm,
                      }}
                    >
                      {monthOptions.map((monthOption) => {
                        const monthBase = createDate(viewDate.getFullYear(), monthOption.index, 1);
                        const previewDate = createDate(
                          viewDate.getFullYear(),
                          monthOption.index,
                          Math.min(highlightedDate.getDate(), daysInMonth(monthBase))
                        );
                        const isSelected =
                          selectedDate?.getFullYear() === viewDate.getFullYear() &&
                          selectedDate?.getMonth() === monthOption.index;

                        return (
                          <button
                            key={monthOption.label}
                            type="button"
                            style={selectorButtonStyle(Boolean(isSelected), isCompact)}
                            onClick={() => {
                              syncVisibleDate(previewDate);
                              setPickerView('days');
                            }}
                          >
                            {monthOption.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {pickerView === 'years' ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: space.sm,
                      }}
                    >
                      {Array.from({ length: 12 }, (_, index) => currentYearRangeStart + index).map(
                        (year) => {
                          const isSelected = selectedDate?.getFullYear() === year;

                          return (
                            <button
                              key={year}
                              type="button"
                              style={selectorButtonStyle(Boolean(isSelected), isCompact)}
                              onClick={() => {
                                const targetMonth = createDate(year, viewDate.getMonth(), 1);
                                syncVisibleDate(
                                  createDate(
                                    year,
                                    viewDate.getMonth(),
                                    Math.min(highlightedDate.getDate(), daysInMonth(targetMonth))
                                  )
                                );
                                setPickerView('months');
                              }}
                            >
                              {year}
                            </button>
                          );
                        }
                      )}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'grid',
                      gap: isCompact ? space.sm : space.xs,
                      gridTemplateColumns: isCompact
                        ? 'minmax(0, 1fr)'
                        : 'repeat(2, minmax(0, 1fr))',
                    }}
                  >
                    <button
                      type="button"
                      style={chipButtonStyle(isCompact)}
                      onClick={() => {
                        syncVisibleDate(today);
                        setTypedDateValue(formatIsoDate(today));
                        setPickerView('days');
                      }}
                    >
                      Jump to today
                    </button>
                    <button
                      type="button"
                      style={chipButtonStyle(isCompact)}
                      onClick={() => commitDate(null)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          </PopupPortal>
        ) : null}
      </div>
    </FieldFrame>
  );
}
