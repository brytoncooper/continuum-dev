import type {
  StarterKitExecutionTarget,
  StarterKitScalarValue,
} from './types.js';

function unwrapNodeValueLike(rawValue: unknown): unknown {
  if (
    rawValue &&
    typeof rawValue === 'object' &&
    'value' in (rawValue as Record<string, unknown>) &&
    Object.keys(rawValue as Record<string, unknown>).length <= 5
  ) {
    return (rawValue as Record<string, unknown>).value;
  }

  return rawValue;
}

function coerceBooleanValue(rawValue: unknown): boolean | undefined {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    return rawValue !== 0;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'on' ||
      normalized === 'enabled'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'off' ||
      normalized === 'disabled'
    ) {
      return false;
    }
  }

  return undefined;
}

function coerceNumberValue(rawValue: unknown): number | undefined {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.replace(/[$,%\s,]/g, '').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mapOptionValue(
  options: StarterKitExecutionTarget['options'],
  rawValue: unknown
): string | undefined {
  if (!Array.isArray(options) || options.length === 0) {
    return undefined;
  }

  const normalized =
    typeof rawValue === 'string'
      ? rawValue.trim().toLowerCase()
      : String(rawValue).trim().toLowerCase();

  const exactValue = options.find(
    (option) =>
      option &&
      typeof option.value === 'string' &&
      option.value.trim().toLowerCase() === normalized
  );
  if (exactValue?.value) {
    return exactValue.value;
  }

  const exactLabel = options.find(
    (option) =>
      option &&
      typeof option.label === 'string' &&
      option.label.trim().toLowerCase() === normalized
  );
  if (exactLabel?.value) {
    return exactLabel.value;
  }

  return undefined;
}

export function coerceScalarStateValue(
  target: StarterKitExecutionTarget,
  rawValue: unknown
): StarterKitScalarValue | undefined {
  const value = unwrapNodeValueLike(rawValue);

  if (value === undefined || value === null) {
    return undefined;
  }

  if (target.nodeType === 'toggle') {
    return coerceBooleanValue(value);
  }

  if (
    target.nodeType === 'slider' ||
    (target.nodeType === 'field' && target.dataType === 'number')
  ) {
    return coerceNumberValue(value);
  }

  if (target.nodeType === 'field' && target.dataType === 'boolean') {
    return coerceBooleanValue(value);
  }

  if (target.nodeType === 'select' || target.nodeType === 'radio-group') {
    return mapOptionValue(target.options, value);
  }

  return String(value);
}
