// Deep-merges dictionary parts (plural objects are treated as leaves).
/** @param {any} base @param {...any} parts */
export function mergeDictionaries(base, ...parts) {
  const out = structuredCloneish(base);
  for (const part of parts) merge(out, part);
  return out;
}
/** @param {any} target @param {any} source */
function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !('other' in value) && target[key] && typeof target[key] === 'object') merge(target[key], value);
    else target[key] = value;
  }
}
/** @param {any} value @returns {any} */
function structuredCloneish(value) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, structuredCloneish(v)]));
}
