import { useSyncExternalStore } from 'react';
import { DEFAULT_EVENTS, ScheduleEvent } from './data/schedule';
import { NUTRITION_TARGETS, PROFILE } from './data/profile';
import { Food, FOODS, MealSlot } from './data/foods';
import { WorkoutId } from './data/program';

export interface MealEntry {
  id: string;
  meal: MealSlot;
  name: string;
  foodId?: string;
  g: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  meal: MealSlot;
  items: { foodId: string; g: number }[];
}

export interface SetLog {
  exId: string;
  weight: number;
  reps: number; // для работы на время — секунды
}

export interface Pain { leg: number; back: number; neck: number }

export interface WorkoutLog {
  id: string;
  date: string;
  type: WorkoutId;
  startedAt: number;
  endedAt: number;
  sets: SetLog[];
  skipped: string[];
  pain: Pain;
  watchKcal?: number;
  poolMeters?: number;
}

export interface ActiveWorkout {
  type: WorkoutId;
  startedAt: number;
  stage: 'warmup' | 'exercise' | 'finish';
  index: number; // упражнение или отрезок
  sets: SetLog[];
  skipped: string[];
  poolDone: Record<string, number>; // сегмент -> сделано отрезков
  poolExtra: Record<string, number>; // сегмент -> добавлено отрезков
}

export interface Measurement { date: string; waist?: number; chest?: number; arm?: number; thigh?: number }

export interface AppState {
  version: 1;
  createdAt: string;
  profile: { heightCm: number; kcal: number; proteinMin: number; proteinMax: number; fat: number; carbs: number };
  theme: 'auto' | 'light' | 'dark';
  showGroup1: boolean;
  events: ScheduleEvent[];
  customFoods: Food[];
  meals: Record<string, MealEntry[]>;
  templates: MealTemplate[];
  workouts: WorkoutLog[];
  active?: ActiveWorkout;
  weights: { date: string; kg: number }[];
  measurements: Measurement[];
  sleep: Record<string, number>;
  kcalChanges: { date: string; from: number; to: number; reason: string }[];
  kcalCheckDismissed?: string;
}

const KEY = 'moy-trener-v1';

function initial(): AppState {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    profile: { heightCm: PROFILE.heightCm, ...NUTRITION_TARGETS },
    theme: 'auto',
    showGroup1: true,
    events: DEFAULT_EVENTS.map((e) => ({ ...e })),
    customFoods: [],
    meals: {},
    templates: [],
    workouts: [],
    weights: [{ date: todayStr(), kg: PROFILE.weightKg }],
    measurements: [],
    sleep: {},
    kcalChanges: [],
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial(), ...JSON.parse(raw) };
  } catch { /* приватный режим или битые данные */ }
  return initial();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* нет места */ }
}

export function getState() { return state; }

export function update(fn: (s: AppState) => AppState | void) {
  const draft = structuredClone(state);
  state = fn(draft) || draft;
  persist();
  listeners.forEach((l) => l());
}

export function useStore(): AppState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string) {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error('Не тот файл');
  state = { ...initial(), ...data };
  persist();
  listeners.forEach((l) => l());
}

export function resetAll() {
  state = initial();
  persist();
  listeners.forEach((l) => l());
}

// ---------- даты ----------
export function dateStr(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayStr() { return dateStr(new Date()); }
export function parseDate(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s: string, n: number) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
/** 0 = Пн … 6 = Вс */
export function weekday(s: string) { return (parseDate(s).getDay() + 6) % 7; }
export function daysBetween(a: string, b: string) { return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000); }
export function fmtDate(s: string) { return parseDate(s).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
export function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
export function fromMin(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- вычисления ----------
export function allFoods(s: AppState): Food[] {
  return [...s.customFoods, ...FOODS];
}

export function entryFrom(food: Food, g: number, meal: MealSlot): MealEntry {
  const k = g / 100;
  return { id: uid(), meal, name: food.name, foodId: food.id, g, kcal: Math.round(food.kcal * k), p: +(food.p * k).toFixed(1), f: +(food.f * k).toFixed(1), c: +(food.c * k).toFixed(1) };
}

export function dayTotals(s: AppState, date: string) {
  const list = s.meals[date] || [];
  const t = list.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, f: a.f + e.f, c: a.c + e.c }), { kcal: 0, p: 0, f: 0, c: 0 });
  const slots = new Set(list.map((e) => e.meal)).size;
  return { ...t, slots };
}

export function sortedWeights(s: AppState) {
  return [...s.weights].sort((a, b) => a.date.localeCompare(b.date));
}

/** среднее по весам в окне [from, to] включительно */
export function avgWeight(s: AppState, from: string, to: string): { avg: number; n: number } {
  const list = s.weights.filter((w) => w.date >= from && w.date <= to);
  if (!list.length) return { avg: 0, n: 0 };
  return { avg: list.reduce((a, w) => a + w.kg, 0) / list.length, n: list.length };
}

export function lastWeight(s: AppState) {
  const w = sortedWeights(s);
  return w[w.length - 1];
}

export function eventsForDay(s: AppState, day: number) {
  return s.events
    .filter((e) => e.day === day && (s.showGroup1 || !e.group1))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}

export function fmtKg(n: number) { return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); }
