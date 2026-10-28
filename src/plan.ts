import { allExercises, Exercise, WorkoutId, WORKOUTS } from './data/program';
import { KCAL_RULES } from './data/profile';
import { addDays, AppState, avgWeight, daysBetween, eventsForDay, SetLog, todayStr, update, weekday, WorkoutLog } from './store';

export function dayPlan(s: AppState, date: string) {
  const events = eventsForDay(s, weekday(date));
  const gym = events.find((e) => e.kind === 'gym');
  return {
    classes: events.filter((e) => e.kind === 'class'),
    gym,
    pool: events.find((e) => e.kind === 'pool'),
    volleyball: events.find((e) => e.kind === 'volleyball'),
    meals: events.filter((e) => e.kind === 'meal'),
    workout: gym?.workout as WorkoutId | undefined,
  };
}

/** какую тренировку подсветить сегодня */
export function todaysWorkout(s: AppState): WorkoutId | undefined {
  const p = dayPlan(s, todayStr());
  return p.workout ?? (p.pool ? 'pool' : undefined);
}

export function startWorkout(type: WorkoutId) {
  update((s) => {
    s.active = { type, startedAt: Date.now(), stage: 'warmup', index: 0, sets: [], skipped: [], poolDone: {}, poolExtra: {} };
  });
}

export function lastLogWith(s: AppState, exId: string): WorkoutLog | undefined {
  for (let i = s.workouts.length - 1; i >= 0; i--) {
    if (s.workouts[i].sets.some((x) => x.exId === exId)) return s.workouts[i];
  }
}

export function lastSets(s: AppState, exId: string): SetLog[] {
  return lastLogWith(s, exId)?.sets.filter((x) => x.exId === exId) ?? [];
}

/** дней с первой тренировки в зале */
export function trainingDays(s: AppState) {
  const first = s.workouts.find((w) => w.type !== 'pool');
  return first ? daysBetween(first.date, todayStr()) : 0;
}

export function progressionHint(s: AppState, ex: Exercise): { text: string; add: number } | null {
  const prev = lastSets(s, ex.id);
  if (!prev.length) return { text: 'Первый раз — возьми лёгкий вес и учи технику.', add: 0 };
  if (ex.bodyweight) {
    return prev.every((x) => x.reps >= ex.repsMax) ? { text: ex.timed ? 'Держится легко — добавь 5–10 сек.' : 'Легко — делай медленнее.', add: 0 } : null;
  }
  const allTop = prev.length >= ex.sets && prev.every((x) => x.reps >= ex.repsMax);
  if (!allTop) return { text: `Держи вес, добери до ${ex.repsMax}${ex.timed ? ' сек' : ''} во всех подходах.`, add: 0 };
  if (trainingDays(s) < 14) return { text: 'Все повторы сделаны. Первые 2 недели — не спеши, закрепи технику.', add: 0 };
  if (ex.timed) return { text: 'Добавь вес: +2 кг на гантель.', add: 2 };
  return ex.legs ? { text: 'Добавь вес: +2,5 кг', add: 2.5 } : { text: 'Добавь вес: +1–2 кг', add: 1 };
}

export function bestSet(sets: SetLog[]) {
  return sets.reduce<SetLog | null>((b, x) => (!b || x.weight > b.weight || (x.weight === b.weight && x.reps > b.reps) ? x : b), null);
}

export function exerciseById(id: string) {
  return allExercises().find((e) => e.id === id);
}

export function workoutExercises(type: WorkoutId) {
  return type === 'pool' ? [] : WORKOUTS[type].exercises;
}

/** подсказка по калориям раз в 2 недели */
export function kcalSuggestion(s: AppState) {
  const today = todayStr();
  const last = s.kcalChanges[s.kcalChanges.length - 1]?.date;
  const since = [last, s.kcalCheckDismissed].filter(Boolean).sort().pop();
  if (since && daysBetween(since, today) < 14) return null;
  const firstWeight = [...s.weights].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!firstWeight || daysBetween(firstWeight.date, today) < 14) return null;
  const cur = avgWeight(s, addDays(today, -13), today);
  const prev = avgWeight(s, addDays(today, -27), addDays(today, -14));
  // если за прошлые 2 недели нет данных — сравниваем с самым первым взвешиванием
  const base = prev.n ? prev.avg : firstWeight.kg;
  if (cur.n < 3) return null;
  const diff = +(cur.avg - base).toFixed(2);
  const kcal = s.profile.kcal;
  if (diff < KCAL_RULES.notGrowingBelowKg)
    return { diff, to: kcal + KCAL_RULES.notGrowingAdd, text: `Вес не растёт (${sign(diff)} кг за 2 недели). Добавь ~${KCAL_RULES.notGrowingAdd} ккал.` };
  if (diff > KCAL_RULES.tooFastAboveKg)
    return { diff, to: kcal - KCAL_RULES.tooFastSubtract, text: `Слишком быстро (${sign(diff)} кг за 2 недели). Убери ~${KCAL_RULES.tooFastSubtract} ккал.` };
  return { diff, to: kcal, text: `${sign(diff)} кг за 2 недели — всё правильно, калории не меняем.` };
}

const sign = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
