// Unit test modules: pure logic only, run in browsers and in Node (CI).
export const unitTests = [
  () => import('./time.test.js'),
  () => import('./money.test.js'),
  () => import('./text-units.test.js'),
  () => import('./store.test.js'),
  () => import('./migrations-seed.test.js'),
  () => import('./router.test.js'),
  () => import('./i18n.test.js'),
];
