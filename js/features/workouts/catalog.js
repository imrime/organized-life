// @ts-check
// Exercise seeds (docs/spec/04-data-model.md §6): bodyweight, dumbbell, barbell, kettlebell, band, cardio and mobility basics.

/** @typedef {'none'|'mat'|'dumbbells'|'barbell'|'kettlebell'|'bands'|'bench'|'pullup_bar'|'machine'|'cardio_machine'} Equipment */
/** @typedef {'chest'|'back'|'shoulders'|'biceps'|'triceps'|'core'|'quads'|'hamstrings'|'glutes'|'calves'|'full_body'|'cardio'} Muscle */

/** @type {Equipment[]} */
export const EQUIPMENT = ['none', 'mat', 'dumbbells', 'barbell', 'kettlebell', 'bands', 'bench', 'pullup_bar', 'machine', 'cardio_machine'];

/** Muscle filter chips → muscles. */
export const MUSCLE_GROUPS = /** @type {Record<string, Muscle[]>} */ ({
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  legs: ['quads', 'hamstrings', 'calves'],
  glutes: ['glutes'],
  full_body: ['full_body'],
  cardio: ['cardio'],
});

/**
 * [key, type, metric, equipment (any is enough), muscles (first = primary), substitution keys]
 * @type {[string, 'strength'|'cardio'|'mobility', 'reps'|'time'|'distance', Equipment[], Muscle[], string[]][]}
 */
export const SEED_EXERCISES = [
  ['pushup', 'strength', 'reps', ['none'], ['chest', 'triceps', 'shoulders'], ['knee_pushup', 'db_bench_press', 'bench_press']],
  ['knee_pushup', 'strength', 'reps', ['none', 'mat'], ['chest', 'triceps'], ['pushup']],
  ['bench_press', 'strength', 'reps', ['barbell'], ['chest', 'triceps', 'shoulders'], ['db_bench_press', 'pushup']],
  ['db_bench_press', 'strength', 'reps', ['dumbbells'], ['chest', 'triceps'], ['bench_press', 'pushup']],
  ['db_fly', 'strength', 'reps', ['dumbbells'], ['chest'], ['pushup']],
  ['overhead_press', 'strength', 'reps', ['barbell'], ['shoulders', 'triceps'], ['db_shoulder_press', 'pike_pushup']],
  ['db_shoulder_press', 'strength', 'reps', ['dumbbells', 'kettlebell'], ['shoulders', 'triceps'], ['overhead_press', 'pike_pushup']],
  ['pike_pushup', 'strength', 'reps', ['none'], ['shoulders', 'triceps'], ['db_shoulder_press']],
  ['lateral_raise', 'strength', 'reps', ['dumbbells', 'bands'], ['shoulders'], ['db_shoulder_press']],
  ['pullup', 'strength', 'reps', ['pullup_bar'], ['back', 'biceps'], ['band_row', 'db_row', 'inverted_row']],
  ['inverted_row', 'strength', 'reps', ['pullup_bar'], ['back', 'biceps'], ['pullup', 'db_row']],
  ['db_row', 'strength', 'reps', ['dumbbells', 'kettlebell'], ['back', 'biceps'], ['barbell_row', 'band_row']],
  ['barbell_row', 'strength', 'reps', ['barbell'], ['back', 'biceps'], ['db_row', 'band_row']],
  ['band_row', 'strength', 'reps', ['bands'], ['back', 'biceps'], ['db_row']],
  ['band_pull_apart', 'strength', 'reps', ['bands'], ['back', 'shoulders'], ['superman']],
  ['superman', 'strength', 'time', ['none', 'mat'], ['back', 'glutes'], ['band_pull_apart']],
  ['bicep_curl', 'strength', 'reps', ['dumbbells', 'bands', 'barbell'], ['biceps'], ['band_row']],
  ['tricep_dip', 'strength', 'reps', ['bench', 'none'], ['triceps', 'chest'], ['tricep_extension', 'knee_pushup']],
  ['tricep_extension', 'strength', 'reps', ['dumbbells', 'bands'], ['triceps'], ['tricep_dip']],
  ['squat', 'strength', 'reps', ['none'], ['quads', 'glutes'], ['goblet_squat', 'barbell_squat', 'lunge']],
  ['goblet_squat', 'strength', 'reps', ['dumbbells', 'kettlebell'], ['quads', 'glutes'], ['squat', 'barbell_squat']],
  ['barbell_squat', 'strength', 'reps', ['barbell'], ['quads', 'glutes'], ['goblet_squat', 'squat']],
  ['lunge', 'strength', 'reps', ['none', 'dumbbells'], ['quads', 'glutes'], ['split_squat', 'squat']],
  ['split_squat', 'strength', 'reps', ['bench', 'none'], ['quads', 'glutes'], ['lunge']],
  ['glute_bridge', 'strength', 'reps', ['none', 'mat'], ['glutes', 'hamstrings'], ['hip_thrust']],
  ['hip_thrust', 'strength', 'reps', ['barbell', 'dumbbells'], ['glutes', 'hamstrings'], ['glute_bridge']],
  ['deadlift', 'strength', 'reps', ['barbell'], ['hamstrings', 'back', 'glutes'], ['romanian_deadlift', 'kb_swing']],
  ['romanian_deadlift', 'strength', 'reps', ['dumbbells', 'barbell', 'kettlebell'], ['hamstrings', 'glutes'], ['deadlift', 'glute_bridge']],
  ['kb_swing', 'strength', 'reps', ['kettlebell'], ['glutes', 'hamstrings', 'full_body'], ['romanian_deadlift']],
  ['calf_raise', 'strength', 'reps', ['none', 'dumbbells'], ['calves'], ['jump_rope']],
  ['plank', 'strength', 'time', ['none', 'mat'], ['core'], ['side_plank', 'dead_bug']],
  ['side_plank', 'strength', 'time', ['none', 'mat'], ['core'], ['plank']],
  ['dead_bug', 'strength', 'reps', ['mat', 'none'], ['core'], ['plank', 'crunch']],
  ['crunch', 'strength', 'reps', ['mat', 'none'], ['core'], ['dead_bug']],
  ['mountain_climbers', 'cardio', 'time', ['none'], ['core', 'cardio'], ['burpees', 'jumping_jacks']],
  ['burpees', 'cardio', 'reps', ['none'], ['full_body', 'cardio'], ['mountain_climbers', 'jumping_jacks']],
  ['jumping_jacks', 'cardio', 'time', ['none'], ['cardio', 'full_body'], ['jump_rope', 'burpees']],
  ['jump_rope', 'cardio', 'time', ['none'], ['cardio', 'calves'], ['jumping_jacks']],
  ['running', 'cardio', 'distance', ['none', 'cardio_machine'], ['cardio'], ['cycling', 'rowing']],
  ['cycling', 'cardio', 'distance', ['cardio_machine', 'none'], ['cardio', 'quads'], ['running']],
  ['rowing', 'cardio', 'distance', ['cardio_machine', 'machine'], ['cardio', 'back'], ['running']],
  ['stretching', 'mobility', 'time', ['none', 'mat'], ['full_body'], ['yoga_flow']],
  ['yoga_flow', 'mobility', 'time', ['mat'], ['full_body', 'core'], ['stretching']],
];
