// @ts-check
// Study geometry (docs/spec/rooms/study.md §1.1). Coordinates are normalised to the 1080 × 1620 safe zone.

/** @type {import('../types.js').SceneObject[]} */
export const objects = [
  {
    id: 'study.computer',
    roomId: 'study',
    code: 'S1',
    labelKey: 'objects.study.computer.name',
    descriptionKey: 'objects.study.computer.desc',
    action: 'open_window',
    window: 'study.main',
    hitArea: { x: 0.4, y: 0.32, width: 0.34, height: 0.2 },
    z: 20,
    dataKey: ['tasks', 'studyModules', 'events'],
    feedback: 'screen',
    phase: 6,
  },
  {
    id: 'study.planner',
    roomId: 'study',
    code: 'S2',
    labelKey: 'objects.study.planner.name',
    descriptionKey: 'objects.study.planner.desc',
    action: 'open_window',
    window: 'study.planner',
    hitArea: { x: 0.4, y: 0.06, width: 0.54, height: 0.18 },
    z: 10,
    dataKey: ['events', 'tasks', 'studyModules'],
    feedback: 'pin',
    phase: 6,
  },
  {
    id: 'study.bookshelf',
    roomId: 'study',
    code: 'S3',
    labelKey: 'objects.study.bookshelf.name',
    descriptionKey: 'objects.study.bookshelf.desc',
    action: 'open_window',
    window: 'study.resources',
    hitArea: { x: 0.04, y: 0.28, width: 0.24, height: 0.42 },
    z: 10,
    dataKey: ['studyResources', 'notes'],
    feedback: 'book',
    phase: 6,
  },
  {
    id: 'study.desk-planner',
    roomId: 'study',
    code: 'S4',
    labelKey: 'objects.study.deskPlanner.name',
    descriptionKey: 'objects.study.deskPlanner.desc',
    action: 'open_window',
    window: 'focus.main',
    hitArea: { x: 0.78, y: 0.5, width: 0.18, height: 0.1 },
    z: 30,
    dataKey: ['focusSessions', 'tasks'],
    feedback: 'confetti',
    phase: 6,
  },
];

/** @type {import('../types.js').CharacterSpot} */
export const character = { anchor: { x: 0.16, y: 0.97 }, height: 0.3, pose: 'stand' };
