// @ts-check
// Minimal test harness that runs in browsers and Node (no dependencies).

/** @typedef {{ name: string, fn: () => unknown }} TestCase */
/** @typedef {{ name: string, tests: TestCase[] }} Suite */
/** @typedef {{ suite: string, name: string, ok: boolean, error?: string }} Result */

/** @type {Suite[]} */
const suites = [];
/** @type {Suite|null} */
let currentSuite = null;

/**
 * @param {string} name
 * @param {() => void} body
 */
export function describe(name, body) {
  const suite = { name, tests: [] };
  suites.push(suite);
  const previous = currentSuite;
  currentSuite = suite;
  try {
    body();
  } finally {
    currentSuite = previous;
  }
}

/**
 * @param {string} name
 * @param {() => unknown} fn may be async
 */
export function it(name, fn) {
  if (!currentSuite) throw new Error('it() must be called inside describe()');
  currentSuite.tests.push({ name, fn });
}

/** @param {unknown} value */
const show = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/** @param {unknown} a @param {unknown} b @returns {boolean} */
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(/** @type {any} */ (a)[k], /** @type {any} */ (b)[k]));
}

/** @param {unknown} actual */
export function expect(actual) {
  /** @param {boolean} pass @param {string} message */
  const check = (pass, message) => {
    if (!pass) throw new Error(message);
  };
  return {
    /** @param {unknown} expected */
    toBe: (expected) => check(Object.is(actual, expected), `expected ${show(actual)} to be ${show(expected)}`),
    /** @param {unknown} expected */
    toEqual: (expected) => check(deepEqual(actual, expected), `expected ${show(actual)} to equal ${show(expected)}`),
    /** @param {number} expected @param {number} [digits] */
    toBeCloseTo: (expected, digits = 2) =>
      check(Math.abs(Number(actual) - expected) < 10 ** -digits / 2, `expected ${show(actual)} to be close to ${expected}`),
    toBeTruthy: () => check(Boolean(actual), `expected ${show(actual)} to be truthy`),
    toBeFalsy: () => check(!actual, `expected ${show(actual)} to be falsy`),
    /** @param {unknown} item */
    toContain: (item) =>
      check(
        Array.isArray(actual) ? actual.includes(item) : String(actual).includes(String(item)),
        `expected ${show(actual)} to contain ${show(item)}`,
      ),
    toThrow: () => {
      let threw = false;
      try {
        /** @type {() => unknown} */ (actual)();
      } catch {
        threw = true;
      }
      check(threw, 'expected function to throw');
    },
    /** @returns {Promise<void>} */
    rejects: async () => {
      let threw = false;
      try {
        await /** @type {Promise<unknown>} */ (actual);
      } catch {
        threw = true;
      }
      check(threw, 'expected promise to reject');
    },
  };
}

/**
 * Imports the given modules (which register suites) and runs every test.
 * @param {(() => Promise<unknown>)[]} loaders
 * @returns {Promise<Result[]>}
 */
export async function runAll(loaders) {
  for (const load of loaders) await load();
  /** @type {Result[]} */
  const results = [];
  for (const suite of suites) {
    for (const test of suite.tests) {
      try {
        await test.fn();
        results.push({ suite: suite.name, name: test.name, ok: true });
      } catch (err) {
        results.push({ suite: suite.name, name: test.name, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  return results;
}
