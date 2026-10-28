// Расписание пар и тренировок по умолчанию. День: 0 = Пн … 6 = Вс.
// После первого запуска события живут в приложении и меняются там (вкладка «Расписание»).

export type EventKind = 'class' | 'gym' | 'pool' | 'volleyball' | 'meal' | 'other';

export interface ScheduleEvent {
  id: string;
  day: number;
  start: string; // "HH:MM"
  end: string;
  title: string;
  kind: EventKind;
  /** для зала — какая тренировка */
  workout?: 'A' | 'B' | 'C';
  /** пара группы 1 — может быть не моей */
  group1?: boolean;
  online?: boolean;
}

export const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const DAY_NAMES_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export const KIND_LABEL: Record<EventKind, string> = {
  class: 'Пара', gym: 'Зал', pool: 'Бассейн', volleyball: 'Волейбол', meal: 'Еда', other: 'Другое',
};

let n = 0;
const ev = (day: number, start: string, end: string, title: string, kind: EventKind, extra: Partial<ScheduleEvent> = {}): ScheduleEvent =>
  ({ id: `d${++n}`, day, start, end, title, kind, ...extra });

export const VOLLEYBALL_DEFAULT = { start: '19:30', end: '21:00' };

export const DEFAULT_EVENTS: ScheduleEvent[] = [
  // Пары
  ev(0, '10:10', '11:50', 'Illustration 2', 'class'),
  ev(0, '12:30', '14:10', 'Video creation 2', 'class'),
  ev(0, '16:50', '18:30', 'History of art 3', 'class', { online: true }),
  ev(1, '12:30', '14:10', 'Animation 2', 'class'),
  ev(2, '08:00', '09:40', 'Flat printing', 'class'),
  ev(2, '14:40', '16:20', 'Graphic design 2', 'class'),
  ev(2, '16:50', '19:20', 'Drawing 3', 'class'),
  ev(3, '09:00', '11:40', 'Drawing 3', 'class'),
  ev(3, '12:30', '14:10', 'Typography', 'class'),
  ev(3, '12:30', '14:10', 'Basic of photography', 'class', { group1: true }),
  ev(4, '10:10', '11:50', 'Alternative graphic', 'class'),
  ev(4, '12:30', '14:10', 'Alternative graphic', 'class'),
  ev(4, '12:30', '14:10', 'Animation 1', 'class', { group1: true }),
  ev(4, '14:40', '16:20', 'Animation 2', 'class'),

  // Тренировки
  ev(0, VOLLEYBALL_DEFAULT.start, VOLLEYBALL_DEFAULT.end, 'Волейбол (или отдых)', 'volleyball'),
  ev(1, '15:30', '16:45', 'Зал A', 'gym', { workout: 'A' }),
  ev(2, VOLLEYBALL_DEFAULT.start, VOLLEYBALL_DEFAULT.end, 'Волейбол', 'volleyball'),
  ev(3, '15:30', '16:45', 'Зал B', 'gym', { workout: 'B' }),
  ev(4, VOLLEYBALL_DEFAULT.start, VOLLEYBALL_DEFAULT.end, 'Волейбол', 'volleyball'),
  ev(5, '11:00', '12:15', 'Зал C', 'gym', { workout: 'C' }),
  ev(5, '12:15', '12:45', 'Бассейн', 'pool'),

  // Приёмы пищи (4–5 в день)
  ev(0, '08:30', '08:50', 'Завтрак', 'meal'), ev(0, '14:15', '14:40', 'Обед', 'meal'), ev(0, '16:15', '16:30', 'Перекус', 'meal'), ev(0, '18:40', '19:05', 'Ужин', 'meal'),
  ev(1, '08:30', '08:50', 'Завтрак', 'meal'), ev(1, '11:30', '11:55', 'Обед', 'meal'), ev(1, '14:15', '14:30', 'Перекус', 'meal'), ev(1, '17:15', '17:40', 'Ужин', 'meal'),
  ev(2, '07:00', '07:20', 'Завтрак', 'meal'), ev(2, '11:30', '11:55', 'Обед', 'meal'), ev(2, '14:10', '14:30', 'Перекус', 'meal'), ev(2, '16:20', '16:45', 'Ужин', 'meal'),
  ev(3, '08:00', '08:20', 'Завтрак', 'meal'), ev(3, '14:15', '14:40', 'Обед', 'meal'), ev(3, '17:00', '17:25', 'Ужин', 'meal'), ev(3, '19:30', '19:45', 'Перекус', 'meal'),
  ev(4, '08:30', '08:50', 'Завтрак', 'meal'), ev(4, '11:55', '12:20', 'Обед', 'meal'), ev(4, '16:25', '16:45', 'Перекус', 'meal'), ev(4, '18:30', '18:55', 'Ужин', 'meal'),
  ev(5, '09:00', '09:20', 'Завтрак', 'meal'), ev(5, '13:00', '13:30', 'Обед', 'meal'), ev(5, '16:30', '16:45', 'Перекус', 'meal'), ev(5, '19:00', '19:30', 'Ужин', 'meal'),
  ev(6, '09:30', '09:50', 'Завтрак', 'meal'), ev(6, '13:30', '14:00', 'Обед', 'meal'), ev(6, '16:30', '16:45', 'Перекус', 'meal'), ev(6, '19:00', '19:30', 'Ужин', 'meal'),
];
