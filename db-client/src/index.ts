import process from 'process';
import { DeepReadonly } from 'deep-freeze';
import http from 'http';
import https from 'https';
import {
  Document,
  Patch,
  PollOptions,
  Serializable,
  UpdateOptions,
  Version,
} from '@reshuffle/interfaces-node-client/interfaces';
import { Options } from '@reshuffle/interfaces-node-client';
import { DB, Versioned, Q } from './db';

export { Q };

function assertEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Environment variable ${name} not defined`);
  }
  return val;
}

const dbURL = assertEnv('RESHUFFLE_DB_BASE_URL');

const makeDb = (options: Options = {}) => new DB(
  `${dbURL}/v1`,
  {
    appId: assertEnv('RESHUFFLE_APPLICATION_ID'),
    appEnv: assertEnv('RESHUFFLE_APPLICATION_ENV'),
    collection: 'default',
    auth: {
      v1: {
        token: assertEnv('RESHUFFLE_ACCESS_TOKEN'),
      },
    },
  },
  {
    timeoutMs: 2000,
    agent: dbURL.startsWith('https://')
      ? new https.Agent({ keepAlive: true })
      : new http.Agent({ keepAlive: true }),
    ...options,
  },
);

let db = makeDb();

/**
 * Set HTTP options for DB requests
 *
 * ## Example: increase timeouts for large queries
 *
 * ```js
 * db.setDbOptions({ timeoutMs: 10000 });
 * ```
 *
 * Note: timeoutMs is limited to 60 seconds due to runtime invocation limits,
 * accessing larger data sets must be done in batches using query limits.
 */
export function setDbOptions(options: Options = {}) {
  if (options.timeoutMs !== undefined &&
    (typeof options.timeoutMs !== 'number' || options.timeoutMs >= 60000 || options.timeoutMs <= 0)) {
    throw new Error('Reshuffle DB configuration error: timeoutMs must be a number between 0 and 60000');
  }
  db = makeDb(options);
}

/**
 * Gets a single document.
 *
 * @param key of value to fetch
 * @return a promise containing the fetched value or undefined if none found
 */
export async function get<T extends Serializable = any>(key: string): Promise<T | undefined> {
  return db.get(key);
}

/**
 * Atomically creates a document if it does not already exist.
 *
 * @param key of value to store
 * @param value to store
 * @return a promise that is true if key previously had no value and value was stored at key
 */
export async function create(key: string, value: Serializable): Promise<boolean> {
  return db.create(key, value);
}

/**
 * Removes a single document.
 * @param key to remove
 * @return a promise that is true if key was in use (and is now removed)
 */
export async function remove(key: string): Promise<boolean> {
  return db.remove(key);
}

/**
 * Atomically updates the value at key by calling the specified
 * updater function.
 *
 * ## Example: increment a counter
 *
 * If the key is missing, the updater function receives argument
 * `undefined`.  That's a cue for the app to start counting from 0.
 *
 * ```js
 * await db.update('counter', (n) => (n || 0) + 1);
 * ```
 *
 * ## Example: capitalize names
 *
 * ```js
 * await db.update('user', function (user) {
 *     return {
 *       ...user,
 *       firstName: user.firstName.toUpperCase(),
 *       lastName: user.lastName.toUpperCase(),
 *     };
 * });
 * ```
 *
 * @param key Key of the value to update
 *
 * @param updater Function to update stored value.  The updater
 *   function is called with the previous value `state`, which may be
 *   `undefined` if no value is stored at `key`.  It may copy but must
 *   *not* modify its parameter `state`.  When multiple concurrent
 *   updates occur the function may be called multiple times.
 *
 * @return A promise of the new value that was stored.
 */
export async function update<T extends Serializable = any>(
  key: string, updater: (state?: DeepReadonly<T>) => T, options?: UpdateOptions,
): Promise<DeepReadonly<T>> {
  return db.update(key, updater, options);
}
// Available only on backend, needs to pass a function.

/**
 * Finds documents matching query.
 *
 * ## Example: Return all user objects (keys starting `user:`)
 *
 * ```js
 * function getUsers() {
 *   return db.find(db.Q.filter(db.Q.key.startsWith('user:')));
 * }
 * ```
 *
 * @param query the query, constructed using the method
 *   [`db.Q.filter`](_query_.html#filter-1)
 * @return a promise of an array of matching documents
 */
export async function find(query: Q.Query): Promise<Document[]> {
  return db.find(query);
}

/**
 * Polls on updates to specified keys since specified versions.
 *
 * This function is not supported yet.
 */
export async function poll(
  keysToVersions: Array<[string, Version]>,
  opts: PollOptions = {},
): Promise<Array<[string, Patch[]]>> {
  return db.poll(keysToVersions, opts);
}
poll.__reshuffle__ = { exposed: true };

/**
 * Gets a initial document in an intent to for poll on it.
 *
 * This function is not supported yet.
 */
export async function startPolling<T extends Serializable = any>(key: string): Promise<Versioned<T | undefined>> {
  return db.startPolling(key);
}
startPolling.__reshuffle__ = { exposed: true };
