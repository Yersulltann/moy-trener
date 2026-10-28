import { useState } from 'react';
import { DAY_NAMES, DEFAULT_EVENTS, EventKind, KIND_LABEL, ScheduleEvent, VOLLEYBALL_DEFAULT } from '../data/schedule';
import { fromMin, toMin, todayStr, uid, update, useStore, weekday, eventsForDay, AppState } from '../store';
import { Sheet } from '../components/ui';

const START = 7 * 60, END = 21 * 60, HOUR_PX = 46;
const MIN_FREE = 90;
const COLOR: Record<EventKind, string> = { class: 'var(--class)', gym: 'var(--gym)', pool: 'var(--pool)', volleyball: 'var(--volley)', meal: 'var(--meal)', other: 'var(--muted)' };
const y = (m: number) => ((Math.max(START, Math.min(END, m)) - START) / 60) * HOUR_PX;

/** свободные окна ≥ 90 мин с 8:00 до 21:00 (еда не считается занятостью) */
function freeWindows(s: AppState, day: number) {
  const busy = eventsForDay(s, day).filter((e) => e.kind !== 'meal').map((e) => [toMin(e.start), toMin(e.end)] as const);
  const out: [number, number][] = [];
  let cur = 8 * 60;
  for (const [a, b] of busy.sort((p, q) => p[0] - q[0])) {
    if (a - cur >= MIN_FREE) out.push([cur, a]);
    cur = Math.max(cur, b);
  }
  if (END - cur >= MIN_FREE) out.push([cur, END]);
  return out;
}

/** раскладка пересекающихся событий по дорожкам (как в календаре) */
function lanes(list: ScheduleEvent[]) {
  const out = new Map<string, { lane: number; of: number }>();
  const blocks = list.filter((e) => e.kind !== 'meal');
  let group: ScheduleEvent[] = [], groupEnd = -1, ends: number[] = [];
  const flush = () => { group.forEach((e) => { out.get(e.id)!.of = ends.length; }); group = []; ends = []; };
  for (const e of blocks) {
    const a = toMin(e.start), b = toMin(e.end);
    if (a >= groupEnd) { flush(); groupEnd = -1; }
    let lane = ends.findIndex((x) => x <= a);
    if (lane < 0) { lane = ends.length; ends.push(b); } else ends[lane] = b;
    out.set(e.id, { lane, of: 1 });
    group.push(e);
    groupEnd = Math.max(groupEnd, b);
  }
  flush();
  return out;
}

export default function Schedule() {
  const s = useStore();
  const [edit, setEdit] = useState<ScheduleEvent | null>(null);
  const today = weekday(todayStr());
  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START + i * 60);
  const vbDays = new Set(s.events.filter((e) => e.kind === 'volleyball').map((e) => e.day));

  const toggleVolley = (d: number) => update((st) => {
    if (st.events.some((e) => e.kind === 'volleyball' && e.day === d)) st.events = st.events.filter((e) => !(e.kind === 'volleyball' && e.day === d));
    else st.events.push({ id: uid(), day: d, ...VOLLEYBALL_DEFAULT, title: 'Волейбол', kind: 'volleyball' });
  });

  return (
    <div className="stack-lg">
      <header className="row-between">
        <h1>Расписание</h1>
        <button className="btn sm primary" onClick={() => setEdit({ id: '', day: today, start: '15:30', end: '16:45', title: '', kind: 'other' })}>+ Событие</button>
      </header>

      <section className="card tight" style={{ padding: '8px 6px' }}>
        <div className="week">
          <div />
          {DAY_NAMES.map((d, i) => <div key={d} className={`week-head ${i === today ? 'today' : ''}`}>{d}</div>)}
          <div className="week-hours" style={{ height: y(END) }}>
            {hours.map((h) => <span key={h} className="week-hour" style={{ top: y(h) }}>{h / 60}</span>)}
          </div>
          {DAY_NAMES.map((_, day) => (
            <div key={day} className="week-col" style={{ height: y(END) }}>
              {hours.map((h) => <div key={h} className="week-line" style={{ top: y(h) }} />)}
              {freeWindows(s, day).map(([a, b]) => <div key={a} className="free" style={{ top: y(a), height: y(b) - y(a) }} title={`Свободно ${fromMin(a)}–${fromMin(b)}`} />)}
              {(() => { const L = lanes(eventsForDay(s, day)); return eventsForDay(s, day).map((e) => {
                const top = y(toMin(e.start)), h = Math.max(e.kind === 'meal' ? 12 : 16, y(toMin(e.end)) - top);
                const ln = L.get(e.id);
                const pos = ln && ln.of > 1 ? { left: `calc(${(ln.lane / ln.of) * 100}% + 1px)`, right: 'auto', width: `calc(${100 / ln.of}% - 2px)` } : {};
                return (
                  <button key={e.id} lang={e.kind === 'class' ? 'en' : 'ru'} className={`ev ${e.kind === 'meal' ? 'meal' : ''} ${e.group1 ? 'g1' : ''}`} style={{ top, height: h, background: e.kind === 'meal' ? undefined : COLOR[e.kind], ...pos }}
                    onClick={() => setEdit(e)} aria-label={`${e.title} ${e.start}–${e.end}`}>
                    {e.title}
                  </button>
                );
              }); })()}
            </div>
          ))}
        </div>
        <div className="row wrap tiny muted" style={{ gap: 10, marginTop: 8, paddingLeft: 30 }}>
          {(['class', 'gym', 'pool', 'volleyball', 'meal'] as EventKind[]).map((k) => (
            <span key={k} className="row" style={{ gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COLOR[k] }} />{KIND_LABEL[k]}</span>
          ))}
          <span className="row" style={{ gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ok)', opacity: 0.4 }} />свободно ≥ 1,5 ч</span>
        </div>
      </section>

      <section className="card stack">
        <div className="card-title">Дни волейбола</div>
        <div className="chips">
          {DAY_NAMES.map((d, i) => <button key={d} className={`chip ${vbDays.has(i) ? 'on' : ''}`} onClick={() => toggleVolley(i)}>{d}</button>)}
        </div>
        <p className="small muted">Время волейбола меняй, нажав на событие в календаре.</p>
      </section>

      <section className="card stack">
        <label className="row-between">
          <span>Показывать пары группы 1<div className="small muted">Basic of photography (Чт), Animation 1 (Пт)</div></span>
          <input type="checkbox" checked={s.showGroup1} onChange={(e) => update((st) => { st.showGroup1 = e.target.checked; })} style={{ width: 24, height: 24, accentColor: 'var(--accent)' }} />
        </label>
        <button className="btn block ghost danger" onClick={() => confirm('Вернуть расписание по умолчанию? Твои изменения в расписании пропадут.') && update((st) => { st.events = DEFAULT_EVENTS.map((e) => ({ ...e })); })}>
          Сбросить расписание
        </button>
      </section>

      {edit && <EditEvent ev={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditEvent({ ev, onClose }: { ev: ScheduleEvent; onClose: () => void }) {
  const [v, setV] = useState<ScheduleEvent>(ev);
  const isNew = !ev.id;
  const valid = v.title.trim() && toMin(v.end) >= toMin(v.start);
  const save = () => {
    update((s) => {
      const e = { ...v, title: v.title.trim(), workout: v.kind === 'gym' ? v.workout ?? 'A' : undefined };
      if (isNew) s.events.push({ ...e, id: uid() });
      else s.events = s.events.map((x) => (x.id === ev.id ? e : x));
    });
    onClose();
  };
  return (
    <Sheet title={isNew ? 'Новое событие' : 'Событие'} onClose={onClose}>
      <div className="field">
        <label htmlFor="ev-title">Название</label>
        <input id="ev-title" className="input" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </div>
      <div className="field">
        <label>Тип</label>
        <div className="chips">
          {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => <button key={k} className={`chip ${v.kind === k ? 'on' : ''}`} onClick={() => setV({ ...v, kind: k })}>{KIND_LABEL[k]}</button>)}
        </div>
      </div>
      {v.kind === 'gym' && (
        <div className="field">
          <label>Тренировка</label>
          <div className="segmented">
            {(['A', 'B', 'C'] as const).map((w) => <button key={w} className={(v.workout ?? 'A') === w ? 'on' : ''} onClick={() => setV({ ...v, workout: w })}>{w}</button>)}
          </div>
        </div>
      )}
      <div className="field">
        <label>День</label>
        <div className="segmented">
          {DAY_NAMES.map((d, i) => <button key={d} className={v.day === i ? 'on' : ''} onClick={() => setV({ ...v, day: i })}>{d}</button>)}
        </div>
      </div>
      <div className="row">
        <div className="field grow"><label htmlFor="ev-s">Начало</label><input id="ev-s" type="time" className="input" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} /></div>
        <div className="field grow"><label htmlFor="ev-e">Конец</label><input id="ev-e" type="time" className="input" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} /></div>
      </div>
      <button className="btn huge primary" disabled={!valid} onClick={save}>Сохранить</button>
      {!isNew && (
        <button className="btn block danger" onClick={() => { if (confirm(`Удалить «${ev.title}»?`)) { update((s) => { s.events = s.events.filter((x) => x.id !== ev.id); }); onClose(); } }}>
          Удалить событие
        </button>
      )}
    </Sheet>
  );
}
