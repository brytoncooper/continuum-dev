import type { DataSnapshot } from '@continuum-dev/contract';

/**
 * Returns a canonical `DataSnapshot` shape with only supported runtime fields.
 */
export function sanitizeContinuumDataSnapshot(
  data: DataSnapshot | null
): DataSnapshot | null {
  if (!data) {
    return null;
  }

  const sanitized: DataSnapshot = {
    values: data.values,
    lineage: data.lineage,
  };

  if (data.valueLineage) {
    sanitized.valueLineage = data.valueLineage;
  }

  if (data.detachedValues) {
    sanitized.detachedValues = data.detachedValues;
  }

  return sanitized;
}
