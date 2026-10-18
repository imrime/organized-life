// @ts-check
// Database layout: collection names and versions. Field definitions live in docs/spec/04-data-model.md.

/**
 * @typedef {Object} BaseRecord
 * @property {string} id
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} [deletedAt]
 */

export const DB_NAME = 'organized-life';

/** Structural version: bump only when object stores change. */
export const DB_VERSION = 1;

/** Data shape version: bump with every data migration (see migrations.js). */
export const SCHEMA_VERSION = 1;

export const META_STORE = 'meta';

/** Every collection is created up front so later phases rarely need a DB_VERSION bump. */
export const COLLECTIONS = /** @type {const} */ ([
  'profile',
  'alarms',
  'events',
  'sleepLogs',
  'routines',
  'routineRuns',
  'tasks',
  'projects',
  'notes',
  'medications',
  'doseLogs',
  'inventoryItems',
  'products',
  'shoppingItems',
  'recipes',
  'meals',
  'clothingItems',
  'outfits',
  'laundryExtras',
  'laundryLoads',
  'media',
  'playlists',
  'mediaCollections',
  'creativeProjects',
  'studyModules',
  'studyResources',
  'focusSessions',
  'exercises',
  'workoutPlans',
  'workoutSessions',
  'accounts',
  'financeCategories',
  'transactions',
  'budgets',
  'walks',
  'places',
  'reminderState',
  'achievementUnlocks',
]);

/** Fixed ids of singleton records in the `profile` collection. */
export const PROFILE = /** @type {const} */ ({
  settings: 'settings',
  character: 'character',
  sleepPlan: 'sleepPlan',
  fitness: 'fitness',
  stats: 'stats',
});

/** Soft-deleted records older than this are purged at startup. */
export const PURGE_AFTER_DAYS = 30;
