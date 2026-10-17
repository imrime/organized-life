# 04 · Data model

All persistent data lives in IndexedDB `organized-life`, one object store per collection ([02 §5](02-architecture.md#5-state-store-and-persistence)). Types below use TypeScript-like notation; implementation uses JSDoc typedefs in `js/core/schema.js` and the feature `model.js` files.

## 1. Conventions

```ts
type Id = string;            // crypto.randomUUID()
type ISO = string;           // instant, UTC, e.g. "2026-10-17T06:00:00.000Z"
type LocalDate = string;     // "YYYY-MM-DD" in the device's local calendar
type LocalTime = string;     // "HH:MM" 24-hour wall-clock
type Minor = number;         // integer money in minor units (cents, kopecks)
type Weekday = 1|2|3|4|5|6|7 // ISO: 1 = Monday … 7 = Sunday

interface Base {
  id: Id;
  createdAt: ISO;
  updatedAt: ISO;
  deletedAt?: ISO | null;    // soft delete; purged after 30 days
}
```

- Every record in every collection extends `Base` (singletons in `profile` too).
- Free-text limits: titles/names ≤ 120 chars, notes ≤ 5000 chars, labels ≤ 40 chars.
- Seeded records carry `seedKey?: string` (i18n key) and `name?: string` (user override).
- No derived values are stored if they can be computed cheaply (streaks, balances, stock levels, PRs) — except where noted for performance.

## 2. Shared types

```ts
interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;                 // ≥ 1
  byWeekday?: Weekday[];            // weekly only; empty → weekday of start date
  until?: LocalDate;                // inclusive
  exDates?: LocalDate[];            // skipped occurrences ("delete only this one")
}
// Monthly on day 29–31 clamps to the last day of shorter months.

type ReminderOffsetMin = null | 0 | 5 | 10 | 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;
// null = no reminder; 0 = at time; 1440 = 1 day before. All-day items: offset counts from 09:00 of the day.

type Unit = 'pcs' | 'g' | 'kg' | 'ml' | 'l' | 'pack';
// Conversions: g↔kg (×1000), ml↔l (×1000); 'pcs' and 'pack' only compare with themselves.

type ColorKey = 'white'|'cream'|'grey'|'black'|'navy'|'blue'|'green'|'olive'|'yellow'|'orange'|'red'|'pink'|'purple'|'brown'|'beige'|'denim';
```

## 3. Collections

### 3.1 `profile` (singletons)

```ts
interface Settings extends Base {          // id: 'settings'
  language: 'en' | 'ru';                    // default 'en'; 'ru' only when chosen by the user
  currency: string;                         // ISO 4217, default from the device region (uk-UA → UAH, de-DE → EUR, en-US → USD; none → EUR)
  weekStart: 1 | 7;                         // Monday or Sunday
  timeFormat: '24h' | '12h';
  units: 'metric' | 'imperial';
  textSize: 'S' | 'M' | 'L' | 'XL';
  reduceMotion: 'system' | 'on' | 'off';
  showHints: boolean;
  nextTaskStrip: boolean;
  optionalRooms: { study: boolean; gym: boolean };   // true = shown (default); false hides the room, data kept
  toursSeen: LocationId[];                  // room tours completed or skipped
  visited: LocationId[];                    // for the "Wanderer" achievement
  lastLocationId: LocationId;
  onboarding: { step: number; done: boolean };
  notificationsEnabled: boolean;
  alarmVolume: number;                      // 0..1
  nightstandPrompt: boolean;                // suggest Nightstand mode at bedtime, default true
  kcalTarget?: number | null;
  showBalanceOnAtm: boolean;                // default false (privacy)
  lastSeenVersion: string;
  lastBackupAt?: ISO | null;
  stripDismissed: { key: string; date: LocalDate }[];  // next-task items hidden for today
}

interface Character extends Base {        // id: 'character'
  name: string;                             // default '' → shown as "You"
  skinTone: 1|2|3|4|5|6|7|8;
  hairStyle: 'short'|'buzz'|'bob'|'long'|'curly'|'ponytail'|'bun'|'afro';
  hairColor: 'black'|'dark-brown'|'brown'|'auburn'|'blonde'|'ginger'|'grey'|'white'|'blue'|'pink';
  bodyShape: 'a' | 'b' | 'c';
  glasses: boolean;
  equipped: { top?: Id|null; bottom?: Id|null; dress?: Id|null; outerwear?: Id|null; shoes?: Id|null; accessory?: Id|null };
}

interface SleepPlan extends Base {        // id: 'sleepPlan'
  bedtime: LocalTime;                       // default '23:00'
  wakeTime: LocalTime;                      // default '07:00'
  windDownMin: 0 | 15 | 30 | 45 | 60;       // default 30; 0 = no wind-down reminder
  linkAlarm: boolean;                       // keep primary alarm = wakeTime
  alarmDays: Weekday[];                     // days for the linked alarm, default all
  bedtimeRoutineId: Id;
  pendingBedAt?: string | null;             // local "YYYY-MM-DDTHH:MM" set by "Go to sleep"; cleared when the morning log is saved or discarded
}

interface Fitness extends Base {          // id: 'fitness'
  equipment: Equipment[];                   // default ['none', 'mat']
  weeklyGoal: number;                       // default 3
}
```

### 3.2 `alarms`

```ts
interface Alarm extends Base {
  time: LocalTime;
  repeatDays: Weekday[];                    // [] = one-shot (next occurrence)
  label: string;
  sound: 'chime' | 'birds' | 'beep' | 'rising';
  vibrate: boolean;
  snoozeMin: 5 | 10 | 15;
  enabled: boolean;
  primary: boolean;                         // exactly one or zero alarms are primary (linked to SleepPlan)
  order: number;
}
```

### 3.3 `events` (calendar, also timetable/exams/deadlines)

```ts
interface CalendarEvent extends Base {
  title: string;
  kind: 'event' | 'deadline' | 'exam' | 'class' | 'reminder';
  date: LocalDate;                          // first occurrence
  allDay: boolean;
  start?: LocalTime;  end?: LocalTime;      // required when !allDay; end > start (same day only in v1)
  recurrence?: Recurrence | null;
  reminderOffsetMin: ReminderOffsetMin;
  location?: string;
  notes?: string;
  moduleId?: Id | null;                     // study link (class, exam, deadline)
  color?: ColorKey | null;                  // default by kind / module colour
}
```

### 3.4 `sleepLogs`

```ts
interface SleepLog extends Base {
  date: LocalDate;                          // the morning date (day you woke up); unique per date
  bedAt: string;                            // local "YYYY-MM-DDTHH:MM"
  wakeAt: string;                           // local "YYYY-MM-DDTHH:MM", > bedAt, ≤ 16 h later
  quality?: 1|2|3|4|5 | null;
  notes?: string;
}
```

### 3.5 `routines`, `routineRuns`

```ts
interface Routine extends Base {
  name: string;  seedKey?: string;
  owner: 'bedroom.bed' | 'bathroom.mirror-sink' | 'bathroom.bath-shower';
  slot: 'morning' | 'evening' | 'bedtime' | 'habit';
  steps: { id: Id; label: string; seedKey?: string }[];   // may be empty for single-checkbox habits
  days: Weekday[];                          // active days, default all
  reminderTime?: LocalTime | null;
  enabled: boolean;
  order: number;
}

interface RoutineRun extends Base {         // one per routine per date (created on first check)
  routineId: Id;
  date: LocalDate;
  doneStepIds: Id[];
  completedAt?: ISO | null;                 // set when all steps done (or habit checked)
}
```

### 3.6 `tasks`, `projects`, `notes`

```ts
interface Task extends Base {
  title: string;
  notes?: string;
  context: 'personal' | 'homework' | 'study';
  status: 'todo' | 'doing' | 'done';
  completedAt?: ISO | null;
  dueDate?: LocalDate | null;
  dueTime?: LocalTime | null;
  reminderOffsetMin: ReminderOffsetMin;
  priority: 'low' | 'normal' | 'high';
  projectId?: Id | null;
  moduleId?: Id | null;                     // required when context = 'study'
  checklist: { id: Id; label: string; done: boolean }[];
  grade?: string;                           // study only, free text ("A", "92/100")
  order: number;
}

interface Project extends Base {
  name: string;
  context: 'personal' | 'homework' | 'study';
  color: ColorKey;
  notes?: string;
  archived: boolean;
}

interface Note extends Base {
  title: string;                            // may be '' → first line of body shown
  body: string;
  pinned: boolean;
  context: 'personal' | 'study';
  moduleId?: Id | null;
}
```

### 3.7 `medications`, `doseLogs`

```ts
interface Medication extends Base {
  name: string;
  form: 'pill' | 'capsule' | 'liquid' | 'drops' | 'spray' | 'injection' | 'patch' | 'other';
  dose: string;                             // "1 tablet", "5 ml"
  schedule: {
    type: 'daily' | 'weekdays' | 'interval' | 'as_needed';
    times: LocalTime[];                     // ≥ 1 unless as_needed
    days?: Weekday[];                       // type 'weekdays'
    everyNDays?: number;                    // type 'interval', ≥ 2
    startDate: LocalDate;
    endDate?: LocalDate | null;
  };
  instructions?: string;                    // "with food"
  stock?: number | null;                    // units left (optional)
  dosePerIntake?: number;                   // units consumed per "taken", default 1
  refillAt?: number | null;                 // threshold → refill suggestion
  color: ColorKey;
  active: boolean;                          // archived meds keep history
}

interface DoseLog extends Base {
  medicationId: Id;
  date: LocalDate;
  scheduledTime?: LocalTime | null;         // null for as-needed
  status: 'taken' | 'skipped';
  at: ISO;                                  // when the user marked it
  note?: string;
}
// Derived per scheduled dose: 'upcoming' | 'due' (±60 min) | 'overdue' (>60 min, same day) | 'missed' (day passed) | 'taken' | 'skipped'.
```

### 3.8 `inventoryItems`

```ts
interface InventoryItem extends Base {
  name: string;
  productId?: Id | null;
  location: 'fridge' | 'freezer' | 'pantry' | 'bathroom';
  category: FoodCategory | BathCategory;
  quantity: number;                         // ≥ 0
  unit: Unit;
  expiryDate?: LocalDate | null;
  openedAt?: LocalDate | null;
  useWithinMonths?: number | null;          // bathroom products: period after opening → derived expiry
  lowStockAt?: number | null;               // threshold (same unit)
  spot?: string;                            // storage location text ("Top shelf")
  notes?: string;
}
type FoodCategory = 'dairy'|'meat_fish'|'produce'|'bakery'|'frozen'|'drinks'|'grains'|'canned'|'spices'|'snacks'|'baking'|'sauces'|'other_food';
type BathCategory = 'skincare'|'hygiene'|'haircare'|'cosmetics'|'cleaning'|'paper'|'first_aid'|'other_bath';
// Effective expiry = min(expiryDate, openedAt + useWithinMonths).
// Stock level (when lowStockAt set): out (0) | low (≤ lowStockAt) | ok (≤ 2×lowStockAt) | full.
// Zero quantity: item is kept (shows "Out") if lowStockAt is set, otherwise removed automatically.
```

### 3.9 `products` (shop catalogue, autocomplete source)

```ts
interface Product extends Base {
  name?: string;  seedKey?: string;
  category: FoodCategory | BathCategory | 'household';
  shopCategory: ShopCategory;               // aisle for grouping
  financeCategoryId: Id;                    // Groceries / Household / Personal care / Health
  defaultUnit: Unit;
  defaultQty: number;
  defaultLocation: 'fridge' | 'freezer' | 'pantry' | 'bathroom' | 'none';  // 'none' = not tracked in inventory
  shelfLifeDays?: number | null;            // suggested expiry after purchase
  lastPriceMinor?: Minor | null;            // per defaultQty
  favorite: boolean;
}
type ShopCategory = 'produce'|'bakery'|'dairy'|'meat_fish'|'frozen'|'pantry'|'drinks'|'snacks'|'household'|'personal_care'|'pharmacy'|'hobby'|'other';
// Products are auto-created (deduplicated by normalised name) when the user types a new name anywhere.
```

### 3.10 `shoppingItems`

```ts
interface ShoppingItem extends Base {
  name: string;
  productId?: Id | null;
  shopCategory: ShopCategory;
  quantity: number;
  unit: Unit;
  priority: 'low' | 'normal' | 'high';
  estPriceMinor?: Minor | null;             // line total estimate; fallback product.lastPrice × qty
  checked: boolean;
  checkedAt?: ISO | null;
  source: 'manual' | 'recipe' | 'low_stock' | 'refill' | 'creative';
  sourceId?: Id | null;
  note?: string;
}
```

### 3.11 `recipes`, `meals`

```ts
interface Recipe extends Base {
  title: string;
  servings: number;                         // ≥ 1
  prepMin?: number | null;  cookMin?: number | null;
  tags: string[];
  ingredients: { id: Id; name: string; productId?: Id|null; quantity?: number|null; unit?: Unit|null; optional: boolean }[];
  steps: { id: Id; text: string }[];
  notes?: string;
  favorite: boolean;
  lastCookedAt?: ISO | null;
  cookCount: number;
}

interface Meal extends Base {
  date: LocalDate;
  time?: LocalTime | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food: string;
  portion?: string;
  kcal?: number | null;  proteinG?: number | null;  carbsG?: number | null;  fatG?: number | null;
  recipeId?: Id | null;
  notes?: string;
}
```

### 3.12 Clothing, wardrobe, laundry

```ts
interface ClothingItem extends Base {
  name: string;  seedKey?: string;
  slot: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  template: ClothingTemplate;               // the drawing used for this item in the wardrobe and on the character
  color: ColorKey;
  laundryGroup: 'whites' | 'lights' | 'darks' | 'colours';   // default derived from color, editable
  care: 'normal' | 'delicate' | 'wool' | 'hand_wash' | 'no_wash';  // shoes/accessories default 'no_wash'
  season: 'all' | 'summer' | 'winter' | 'mid';
  status: 'clean' | 'dirty' | 'in_load';
  favorite: boolean;
  isNew: boolean;                           // set by clothing shop, cleared when seen in wardrobe
  priceMinor?: Minor | null;
  purchasedAt?: LocalDate | null;
  transactionId?: Id | null;
  washCount: number;
  notes?: string;
}
type ClothingTemplate =
  | 'tshirt' | 'longsleeve' | 'shirt' | 'blouse' | 'sweater' | 'hoodie' | 'tank'      // top
  | 'jeans' | 'trousers' | 'shorts' | 'skirt' | 'leggings' | 'joggers'                // bottom
  | 'dress' | 'jumpsuit'                                                               // dress
  | 'jacket' | 'coat' | 'blazer' | 'cardigan' | 'raincoat'                             // outerwear
  | 'sneakers' | 'boots' | 'heels' | 'sandals' | 'loafers'                             // shoes
  | 'cap' | 'beanie' | 'scarf' | 'bag' | 'watch';                                      // accessory
// Colour → laundryGroup default: white/cream → whites; grey/beige/yellow/pink → lights; black/navy/denim/brown → darks; others → colours.

interface Outfit extends Base {
  name: string;
  items: Character['equipped'];
  tags: ('work'|'casual'|'sport'|'evening'|'home')[];
  favorite: boolean;
}

interface LaundryExtra extends Base {       // non-wardrobe laundry: towels, bed linen…
  label: string;  seedKey?: string;
  laundryGroup: 'whites' | 'lights' | 'darks' | 'colours';
  status: 'dirty' | 'in_load';
}

interface LaundryLoad extends Base {
  itemIds: Id[];                            // ClothingItem ids
  extraIds: Id[];                           // LaundryExtra ids
  loadType: 'whites' | 'darks' | 'colours' | 'delicates' | 'towels' | 'mixed';
  cycle: 'quick' | 'cotton' | 'synthetics' | 'delicates' | 'wool' | 'eco';
  temperatureC: 20 | 30 | 40 | 60 | 90;
  durationMin: number;
  status: 'queued' | 'running' | 'done' | 'unloaded' | 'cancelled';
  startedAt?: ISO | null;
  finishesAt?: ISO | null;                  // startedAt + durationMin
  finishedAt?: ISO | null;                  // when status became 'done'
}
// Cycle defaults: quick 30 min/30 °C, cotton 150/40, synthetics 100/40, delicates 50/30, wool 40/20, eco 180/40.
// At most one load is 'running' at any time.
```

### 3.13 Media and leisure

```ts
interface MediaItem extends Base {
  kind: 'film' | 'series' | 'game' | 'track' | 'album' | 'book';
  title: string;
  creator?: string;                         // director / developer / artist / author
  year?: number | null;
  status: MediaStatus;
  rating?: 1|2|3|4|5 | null;
  favorite: boolean;
  notes?: string;
  link?: string | null;                     // http(s) only
  tags: string[];                           // mood tags for music, free tags otherwise
  platform?: 'pc'|'playstation'|'xbox'|'switch'|'mobile'|'other' | null;   // games
  whereToWatch?: string;                    // films/series
  progress?: { season?: number; episode?: number; page?: number; totalPages?: number; hours?: number } | null;
  album?: string;                           // tracks
  startedAt?: LocalDate | null;
  finishedAt?: LocalDate | null;            // set when status becomes watched/completed/read/listened
  nowPlaying?: boolean;                     // music: drives player animation
}
type MediaStatus =
  | 'watchlist' | 'watching' | 'watched' | 'dropped'        // film, series
  | 'backlog' | 'playing' | 'paused' | 'completed'          // game (+ 'dropped')
  | 'want' | 'listened'                                     // track, album
  | 'to_read' | 'reading' | 'read';                         // book (+ 'dropped')

interface Playlist extends Base {
  name: string;
  itemIds: Id[];                            // MediaItem ids of kind 'track' (ordered)
  moodTags: string[];
  notes?: string;
  link?: string | null;
  nowPlaying: boolean;                      // at most one playlist true
}

interface MediaCollection extends Base {
  name: string;
  description?: string;
  color: ColorKey;
  itemIds: Id[];                            // any MediaItem / CreativeProject ids
}

interface CreativeProject extends Base {
  title: string;
  medium: 'drawing'|'painting'|'craft'|'knitting'|'sewing'|'photo'|'writing'|'music'|'other';
  status: 'idea' | 'in_progress' | 'paused' | 'done';
  nextStep?: string;
  materials: { id: Id; name: string; have: boolean }[];
  referenceNotes?: string;
  links: string[];
  startedAt?: LocalDate | null;
  finishedAt?: LocalDate | null;
  favorite: boolean;
  order: number;
}
```

### 3.14 Study

```ts
interface StudyModule extends Base {
  name: string;
  code?: string;
  color: ColorKey;
  teacher?: string;
  term?: string;
  credits?: number | null;
  links: { id: Id; label: string; url: string }[];
  nextActionOverride?: string;
  notes?: string;
  archived: boolean;
}

interface StudyResource extends Base {
  moduleId?: Id | null;                     // null = "General" folder
  type: 'book' | 'article' | 'video' | 'link' | 'document' | 'other';
  title: string;
  author?: string;
  url?: string | null;
  citation?: string;
  status: 'to_read' | 'reading' | 'done' | 'reference';     // 'reference' = not on the reading list
  notes?: string;
}

interface FocusSession extends Base {
  taskId?: Id | null;
  moduleId?: Id | null;
  plannedMin: number;                       // default 25
  breakMin: number;                         // default 5
  startedAt: ISO;
  pausedAt?: ISO | null;
  pausedTotalSec: number;
  endedAt?: ISO | null;
  status: 'running' | 'paused' | 'completed' | 'aborted';
  note?: string;
}
```

### 3.15 Workouts

```ts
type Equipment = 'none'|'mat'|'dumbbells'|'barbell'|'kettlebell'|'bands'|'bench'|'pullup_bar'|'machine'|'cardio_machine';
type Muscle = 'chest'|'back'|'shoulders'|'biceps'|'triceps'|'core'|'quads'|'hamstrings'|'glutes'|'calves'|'full_body'|'cardio';

interface Exercise extends Base {
  name?: string;  seedKey?: string;
  type: 'strength' | 'cardio' | 'mobility';
  metric: 'reps' | 'time' | 'distance';
  equipment: Equipment[];                   // any of these is enough
  muscles: Muscle[];                        // first = primary
  substitutionIds: Id[];
  howTo?: string;  howToKey?: string;
  custom: boolean;
}

interface WorkoutPlan extends Base {
  name: string;
  days: Weekday[];                          // scheduled weekdays (may be empty)
  items: { id: Id; exerciseId: Id; sets: number; reps?: number|null; durationSec?: number|null; weightKg?: number|null; restSec: number }[];
  notes?: string;
  archived: boolean;
}

interface WorkoutSession extends Base {
  planId?: Id | null;
  date: LocalDate;
  startedAt: ISO;
  finishedAt?: ISO | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  entries: { id: Id; exerciseId: Id; restSec: number;
             sets: { id: Id; reps?: number|null; weightKg?: number|null; durationSec?: number|null; distanceM?: number|null; done: boolean }[] }[];
  notes?: string;
}
// Weight always stored in kg; displayed in lb when units = imperial (1 kg = 2.20462 lb, rounded to 0.5).
// Personal records are derived: max weight per exercise (any reps), best est. 1RM (Epley: w × (1 + reps/30)), max reps, longest duration.
```

### 3.16 Finance

```ts
interface Account extends Base {
  name: string;  seedKey?: string;          // default 'Wallet'
  type: 'cash' | 'card' | 'bank' | 'savings';
  openingBalanceMinor: Minor;
  archived: boolean;
}

interface FinanceCategory extends Base {
  name?: string;  seedKey?: string;
  kind: 'expense' | 'income';
  icon: string;                             // icon id from js/ui/icons.js
  color: ColorKey;
  archived: boolean;
  order: number;
}

interface Transaction extends Base {
  accountId: Id;
  type: 'expense' | 'income';
  amountMinor: Minor;                       // > 0
  categoryId: Id;
  date: LocalDate;
  note?: string;
  source: { type: 'manual' | 'grocery' | 'clothing'; batchId?: Id | null };
}
// Balance(account) = openingBalanceMinor + Σ income − Σ expense (non-deleted).

interface Budget extends Base {             // one per month
  month: string;                            // "YYYY-MM"
  totalLimitMinor?: Minor | null;
  limits: { categoryId: Id; limitMinor: Minor }[];
}
```

### 3.17 Walks and places

```ts
interface Walk extends Base {
  date: LocalDate;
  startedAt?: ISO | null;
  endedAt?: ISO | null;
  durationMin: number;
  steps?: number | null;
  distanceKm?: number | null;
  placeId?: Id | null;
  notes?: string;
  status: 'running' | 'done';               // at most one running
}

interface Place extends Base {
  name: string;
  notes?: string;
  favorite: boolean;
}
```

### 3.18 System collections

```ts
interface ReminderState extends Base {      // id = reminder instance key
  firedAt?: ISO | null;
  snoozedUntil?: ISO | null;
  ackAt?: ISO | null;                       // dismissed / acted on
}
// Records older than 7 days are purged at startup.

interface AchievementUnlock extends Base {  // id = achievement id
  unlockedAt: ISO;
  seen: boolean;
}

// meta store (not exported in backups except schema/install):
// { id: 'schema', version: number } · { id: 'install', installId: Id, firstLaunchAt: ISO } · { id: 'preMigrationBackup', fromVersion, data }
```

## 4. Collection index

| Store | Feature owner | Written by others? |
|-------|---------------|--------------------|
| `profile` | settings, character, sleep, workouts | onboarding, wardrobe (equipped) |
| `alarms` | alarms | sleep (linked primary alarm) |
| `events` | calendar | study (classes, exams, deadlines) |
| `sleepLogs` | sleep | — |
| `routines`, `routineRuns` | routines | sleep (bedtime routine) |
| `tasks`, `projects`, `notes` | tasks | study (assignments, notes), calendar (opens task pages) |
| `medications`, `doseLogs` | meds | — |
| `inventoryItems` | inventory | checkout, recipes (cook), diary (mark used → meal) |
| `products` | checkout | inventory, shopping, recipes (auto-create) |
| `shoppingItems` | shopping | recipes, inventory, meds, creative (suggestions), checkout (auto-check) |
| `recipes`, `meals` | recipes, diary | — |
| `clothingItems`, `outfits` | wardrobe | clothing shop, laundry (status) |
| `laundryExtras`, `laundryLoads` | laundry | — |
| `media`, `playlists`, `mediaCollections` | media | — |
| `creativeProjects` | creative | — |
| `studyModules`, `studyResources`, `focusSessions` | study, focus | — |
| `exercises`, `workoutPlans`, `workoutSessions` | workouts | — |
| `accounts`, `financeCategories`, `transactions`, `budgets` | finance | checkout, clothing shop |
| `walks`, `places` | walks | — |
| `reminderState` | core/reminders | — |
| `achievementUnlocks` | achievements | — |

## 5. Schema versioning and migrations

- `SCHEMA_VERSION` starts at **1** with the full collection list above (stores are created up front even for later phases, so `DB_VERSION` rarely changes).
- `js/core/migrations.js` exports `[{ to: 2, up(data) { … return data; } }, …]` where `data` is `{ [collection]: Record[] }`. Migrations are pure and unit-tested with fixture data.
- At boot, if stored version < `SCHEMA_VERSION`: keep a pre-migration snapshot in `meta`, run migrations in order, write all touched stores in one transaction, set version. If a migration throws: do not write, show "Update failed to migrate your data" with *Export raw backup* and *Retry*.
- Imports of older backups run through the same migrations.
- Rule: never rename a field without a migration; never reuse an enum value with a different meaning.

## 6. Seed data (first launch)

| Collection | Seed | Count |
|------------|------|-------|
| `profile` | `settings` (language `en`, currency from region, other formats from locale), `character` (random but neutral look), `sleepPlan` (23:00 / 07:00 / 30 min), `fitness` | 4 |
| `accounts` | Wallet (cash), opening balance 0 (asked when Bank is first opened) | 1 |
| `financeCategories` | Expense: Groceries, Household, Personal care, Health & pharmacy, Clothing, Eating out, Transport, Housing & utilities, Entertainment, Education, Sport, Gifts, Other. Income: Salary, Scholarship, Gifts, Other income | 17 |
| `products` | Common groceries and household items with category, unit, location, shelf life (e.g. Milk 1 l fridge 7 d; Eggs 10 pcs fridge 21 d; Bread pcs pantry 4 d; Rice 1 kg pantry; Toothpaste pcs bathroom; Toilet paper pack none…) | ~70 |
| `exercises` | Bodyweight, dumbbell, barbell, kettlebell, band, cardio and mobility basics with substitutions (push-up, squat, lunge, plank, glute bridge, burpees, dumbbell row, goblet squat, bench press, deadlift, overhead press, kettlebell swing, band pull-apart, pull-up, jumping jacks, running, cycling, stretching…) | ~40 |
| `routines` | Morning care (Brush teeth, Wash face, Skincare, Deodorant), Evening care (Wash face, Brush teeth, Skincare), Bedtime (Phone away, Prepare clothes for tomorrow, Read 10 min), Habits: Shower (daily), Hair wash (Mon, Thu), Face mask (Sun, disabled) | 6 |
| `clothingItems` | White T-shirt, Blue jeans, White sneakers, Grey hoodie (equipped) — starter drawings the player edits or replaces with their real clothes | 4 |
| `laundryExtras` | none (chips offer Towels, Bed linen, Sportswear, Other) | 0 |
| `places` | Park | 1 |

Seeded names use `seedKey`; all seeds are editable/deletable.

## 7. Backup format

```json
{
  "app": "organized-life",
  "format": 1,
  "schemaVersion": 1,
  "appVersion": "0.3.0",
  "exportedAt": "2026-10-17T12:00:00.000Z",
  "data": { "profile": [ … ], "alarms": [ … ], "events": [ … ] }
}
```

- File name: `organized-life-backup-YYYY-MM-DD.json`. Export via `Blob` + download (iOS: share sheet via `navigator.share({files})` when available).
- Includes soft-deleted records (for merge correctness); excludes `reminderState` and `meta` except schema.
- **Import → Replace all** (default, confirm dialog with counts) or **Merge** (by `id`, newer `updatedAt` wins). Validation: `app` must match, `schemaVersion` ≤ current (newer → refuse with "Update the app first"), every record must have `id` and timestamps; invalid records are skipped and counted in the result summary.
- Warning before export: "This file contains your personal data (including health and money). Store it somewhere private."
- `.ics` export (P2): calendar events only (with RRULE/EXDATE/VALARM); UTF-8, CRLF line endings, folded lines. Alarms are never exported — they live only in the game ([D-06](01-decisions.md#d-06-reminders-and-alarms)).
