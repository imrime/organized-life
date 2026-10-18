// Unit test modules: pure logic only, run in browsers and in Node (CI).
export const unitTests = [
  () => import('./time.test.js'),
  () => import('./money.test.js'),
  () => import('./text-units.test.js'),
  () => import('./store.test.js'),
  () => import('./migrations-seed.test.js'),
  () => import('./router.test.js'),
  () => import('./i18n.test.js'),
  () => import('./world.test.js'),
  () => import('./alarms.test.js'),
  () => import('./calendar.test.js'),
  () => import('./reminders.test.js'),
  () => import('./bedroom.test.js'),
  () => import('./kitchen.test.js'),
  () => import('./bathroom.test.js'),
  () => import('./leisure.test.js'),
  () => import('./optional.test.js'),
];
