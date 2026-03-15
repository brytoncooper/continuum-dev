import { attemptMigrationImpl } from './migrator-core.js';
import type {
  MigrationAttemptInput as MigrationAttemptInputModel,
  MigrationAttemptResult as MigrationAttemptResultModel,
} from './migrator-core.js';

/**
 * Resolves a node schema transition by selecting and executing a migration
 * strategy with deterministic precedence.
 *
 * Preferred call form:
 * - `attemptMigration({ nodeId, priorNode, newNode, priorValue, options })`
 *
 * Legacy call form (supported, deprecated):
 * - `attemptMigration(nodeId, priorNode, newNode, priorValue, options)`
 *
 * Deterministic precedence:
 * - `options.migrationStrategies[nodeId]`
 * - first matching direct rule in `newNode.migrations`
 * - deterministic BFS chain through `newNode.migrations` (max depth `10`)
 * - `none`
 *
 * Error contract:
 * - Thrown strategy errors are captured and returned as `{ kind: 'error' }`.
 *
 * Import boundary:
 * - Import migrator APIs from `../migrator/index.js` only.
 * - Internal migrator files are intentionally not part of the public API.
 */
export const attemptMigration = attemptMigrationImpl;

/**
 * Typed object input contract for `attemptMigration`.
 */
export type MigrationAttemptInput = MigrationAttemptInputModel;

/**
 * Result contract for migration attempts.
 */
export type MigrationAttemptResult = MigrationAttemptResultModel;
