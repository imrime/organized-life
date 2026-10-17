// Runs the unit tests in Node (used by CI). Browser-only tests run in tests/index.html.
import { runAll } from './harness.js';
import { unitTests } from './unit/index.js';

const results = await runAll(unitTests);
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.suite} › ${r.name}`);
  if (!r.ok) console.log(`    ${r.error}`);
}
console.log(`\n${failed.length ? 'FAIL' : 'PASS'} ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
