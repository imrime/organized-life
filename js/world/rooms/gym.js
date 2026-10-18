// @ts-check
// Gym geometry (docs/spec/rooms/gym.md §1.1). Coordinates are normalised to the 1080 × 1620 safe zone.

/** @type {import('../types.js').SceneObject[]} */
export const objects = [
  {
    id: 'gym.bench-mat',
    roomId: 'gym',
    code: 'G1',
    labelKey: 'objects.gym.benchMat.name',
    descriptionKey: 'objects.gym.benchMat.desc',
    action: 'open_window',
    window: 'workouts.today',
    hitArea: { x: 0.06, y: 0.74, width: 0.64, height: 0.16 },
    z: 10,
    dataKey: ['workoutSessions', 'workoutPlans'],
    feedback: 'towel',
    phase: 6,
  },
  {
    id: 'gym.weights',
    roomId: 'gym',
    code: 'G2',
    labelKey: 'objects.gym.weights.name',
    descriptionKey: 'objects.gym.weights.desc',
    action: 'open_window',
    window: 'workouts.library',
    hitArea: { x: 0.66, y: 0.38, width: 0.3, height: 0.3 },
    z: 10,
    dataKey: ['exercises'],
    feedback: 'clank',
    phase: 6,
  },
  {
    id: 'gym.progress-board',
    roomId: 'gym',
    code: 'G3',
    labelKey: 'objects.gym.progressBoard.name',
    descriptionKey: 'objects.gym.progressBoard.desc',
    action: 'open_window',
    window: 'workouts.progress',
    hitArea: { x: 0.38, y: 0.06, width: 0.56, height: 0.2 },
    z: 10,
    dataKey: ['workoutSessions', 'walks', 'profile'],
    feedback: 'chart',
    phase: 6,
  },
];

/** @type {import('../types.js').CharacterSpot} */
export const character = { anchor: { x: 0.84, y: 0.97 }, height: 0.3, pose: 'stand' };
