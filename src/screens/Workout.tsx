import { useEffect, useMemo, useRef, useState } from 'react';
import { Exercise, exercisePhotos, POOL, RULES, STAGE, WARMUP, WORKOUT_LABEL, WorkoutId, WORKOUTS } from '../data/program';
import { lastSets, progressionHint, startWorkout, todaysWorkout, workoutExercises } from '../plan';
import { ActiveWorkout, AppState, fmtDate, fmtKg, Pain, todayStr, uid, update, useStore } from '../store';
import { beep, ExercisePhoto, fmtSec, Stepper, useNow, useWakeLock } from '../components/ui';

const TYPES: WorkoutId[] = ['A', 'B', 'C', 'pool'];

export default function WorkoutScreen() {
  const s = useStore();
  useWakeLock(!!s.active);
  if (!s.active) return <Picker s={s} />;
  const a = s.active;
  if (a.stage === 'warmup') return <Warmup a={a} />;
  if (a.stage === 'finish') return <Finish s={s} a={a} />;
  return a.type === 'pool' ? <PoolRun a={a} /> : <ExerciseRun s={s} a={a} />;
}

// ---------------- Выбор ----------------
function Picker({ s }: { s: AppState }) {
  const today = todaysWorkout(s);
  const [sel, setSel] = useState<WorkoutId>(today ?? 'A');
  const history = [...s.workouts].reverse().slice(0, 6);
  return (
    <div className="stack-lg">
      <header>
        <p className="muted">{STAGE.title}</p>
        <h1>Тренировка</h1>
      </header>
      <div className="chips">
        {TYPES.map((t) => (
          <button key={t} className={`chip ${sel === t ? 'on' : ''} ${today === t ? 'today' : ''}`} onClick={() => setSel(t)}>
            {WORKOUT_LABEL[t]}{today === t ? ' · сегодня' : ''}
          </button>
        ))}
      </div>

      <section className="card">
        {sel === 'pool' ? (
          <div className="list">
            {POOL.segments.map((g) => (
              <div key={g.id} className="list-item">
                <span className="grow">{g.name}{g.note && <div className="small muted">{g.note}</div>}</span>
                <span className="num muted">{g.reps > 1 ? `${g.reps}×${g.meters} м` : `${g.meters} м`}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="list">
            {WORKOUTS[sel].exercises.map((e, i) => (
              <div key={e.id} className="list-item">
                <span className="muted num" style={{ width: 18 }}>{i + 1}</span>
                <img className="thumb" src={exercisePhotos(e)[0]} alt="" loading="lazy" />
                <span className="grow">{e.name}{e.ankle && <span style={{ color: 'var(--warn)' }}> *</span>}</span>
                <span className="num muted small">{setsLabel(e)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button className="btn huge primary" onClick={() => startWorkout(sel)}>Начать · {WORKOUT_LABEL[sel]}</button>

      <details className="card">
        <summary style={{ fontWeight: 600, cursor: 'pointer' }}>Правила</summary>
        <ul className="tips small" style={{ marginTop: 10 }}>
          {(sel === 'pool' ? POOL.rules : RULES).map((r) => <li key={r}>{r}</li>)}
          {sel !== 'pool' && <li>* — только если голеностоп не болит (боль ≤ 3/10 и утром не хуже).</li>}
        </ul>
      </details>

      {history.length > 0 && (
        <section className="card">
          <div className="card-title">Последние тренировки</div>
          <div className="list">
            {history.map((w) => (
              <div key={w.id} className="list-item small">
                <span style={{ width: 64 }} className="muted">{fmtDate(w.date)}</span>
                <span className="grow"><b>{WORKOUT_LABEL[w.type]}</b> · {Math.round((w.endedAt - w.startedAt) / 60000)} мин{w.type === 'pool' ? ` · ${w.poolMeters} м` : ` · ${w.sets.length} подх.`}</span>
                <span className="muted">боль {w.pain.leg}/{w.pain.back}/{w.pain.neck}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const setsLabel = (e: Exercise) =>
  `${e.sets}×${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}${e.timed ? ' сек' : ''}${e.perSide ? ' /стор.' : ''}`;

function cancelWorkout() {
  if (confirm('Отменить тренировку? Подходы не сохранятся.')) update((s) => { s.active = undefined; });
}

function TopBar({ a, i, n, label }: { a: ActiveWorkout; i: number; n: number; label: string }) {
  const now = useNow(1000);
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row-between">
        <span className="small muted">{WORKOUT_LABEL[a.type]} · {fmtSec((now - a.startedAt) / 1000)}</span>
        <button className="btn sm ghost" onClick={cancelWorkout}>Отменить</button>
      </div>
      <div className="row-between"><b>{label} {i + 1} из {n}</b></div>
      <div className="progress-dots">{Array.from({ length: n }, (_, k) => <span key={k} className={k < i ? 'done' : k === i ? 'cur' : ''} />)}</div>
    </div>
  );
}

// ---------------- Разминка ----------------
function Warmup({ a }: { a: ActiveWorkout }) {
  const [start] = useState(Date.now());
  const now = useNow(500);
  const left = WARMUP.minutes * 60 - (now - start) / 1000;
  const beeped = useRef(false);
  useEffect(() => { if (left <= 0 && !beeped.current) { beeped.current = true; beep(); } }, [left]);
  const next = () => update((s) => { if (s.active) { s.active.stage = 'exercise'; s.active.index = 0; } });
  return (
    <div className="stack-lg">
      <div className="row-between">
        <span className="small muted">{WORKOUT_LABEL[a.type]}</span>
        <button className="btn sm ghost" onClick={cancelWorkout}>Отменить</button>
      </div>
      <h1>Разминка</h1>
      <div className="card center">
        <div className="timer-num" style={{ color: left <= 0 ? 'var(--ok)' : undefined }}>{left > 0 ? fmtSec(left) : 'Готово'}</div>
        <p className="muted small" style={{ marginTop: 8 }}>{WARMUP.minutes} минут</p>
      </div>
      <ol className="tips">{WARMUP.steps.map((x) => <li key={x}>{x}</li>)}</ol>
      {a.type === 'pool' && <div className="alert info">Для бассейна: суставная разминка на суше 3–5 мин — круги руками, плечами, шеей (мягко).</div>}
      <button className="btn huge primary" onClick={next}>{a.type === 'pool' ? 'В воду →' : 'К первому упражнению →'}</button>
    </div>
  );
}

// ---------------- Таймер отдыха ----------------
function RestOverlay({ end, onAdd, onDone, next }: { end: number; onAdd: () => void; onDone: () => void; next?: string }) {
  const now = useNow(250);
  const left = (end - now) / 1000;
  const fired = useRef(false);
  useEffect(() => {
    if (left <= 0 && !fired.current) { fired.current = true; beep(); setTimeout(onDone, 1200); }
  }, [left, onDone]);
  return (
    <div className="overlay">
      <p className="muted">Отдых</p>
      <div className="timer-num" style={{ color: left <= 0 ? 'var(--ok)' : undefined }}>{left > 0 ? fmtSec(left) : 'Пошёл!'}</div>
      {next && <p className="muted small center">Дальше: {next}</p>}
      <div className="row" style={{ width: '100%', maxWidth: 360 }}>
        <button className="btn huge" onClick={onAdd}>+15 сек</button>
        <button className="btn huge primary" onClick={onDone}>Пропустить</button>
      </div>
    </div>
  );
}

// ---------------- Упражнение ----------------
function ExerciseRun({ s, a }: { s: AppState; a: ActiveWorkout }) {
  const list = workoutExercises(a.type);
  const ex = list[a.index];
  const done = a.sets.filter((x) => x.exId === ex.id);
  const prev = lastSets(s, ex.id);
  const hint = progressionHint(s, ex);
  const isAssist = /гравитрон/i.test(ex.equipment);
  const photos = useMemo(() => exercisePhotos(ex), [ex]);

  const defWeight = () => {
    if (done.length) return done[done.length - 1].weight;
    if (prev.length) return isAssist ? prev[0].weight : prev[0].weight + (hint?.add ?? 0);
    return 0;
  };
  const defReps = () => (done.length ? done[done.length - 1].reps : prev[0]?.reps ?? ex.repsMax);
  const [weight, setWeight] = useState(defWeight);
  const [reps, setReps] = useState(defReps);
  const [rest, setRest] = useState<number | null>(null);
  const [work, setWork] = useState<number | null>(null);

  useEffect(() => { setWeight(defWeight()); setReps(defReps()); setWork(null); /* eslint-disable-next-line */ }, [ex.id]);

  const logSet = (r: number) => {
    update((st) => { st.active?.sets.push({ exId: ex.id, weight: ex.bodyweight ? 0 : weight, reps: r }); });
    setRest(Date.now() + ex.rest * 1000);
  };
  const go = (d: number) => update((st) => {
    if (!st.active) return;
    const i = st.active.index + d;
    if (i >= list.length) st.active.stage = 'finish'; else st.active.index = Math.max(0, i);
  });
  const skip = () => update((st) => {
    if (!st.active) return;
    if (!st.active.skipped.includes(ex.id)) st.active.skipped.push(ex.id);
    st.active.sets = st.active.sets.filter((x) => x.exId !== ex.id);
    const i = st.active.index + 1;
    if (i >= list.length) st.active.stage = 'finish'; else st.active.index = i;
  });
  const removeLast = () => update((st) => {
    if (!st.active) return;
    const k = st.active.sets.map((x) => x.exId).lastIndexOf(ex.id);
    if (k >= 0) st.active.sets.splice(k, 1);
  });

  const allDone = done.length >= ex.sets;
  const nextName = allDone ? list[a.index + 1]?.name : ex.name;
  const wLabel = isAssist ? 'Помощь гравитрона, кг' : 'Вес, кг';

  return (
    <div className="stack-lg">
      <TopBar a={a} i={a.index} n={list.length} label="Упражнение" />

      <div className="stack" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 26 }}>{ex.name}</h1>
        <p className="muted">{ex.equipment}</p>
        <div className="row wrap">
          <span className="badge accent">{setsLabel(ex)}</span>
          <span className="badge">отдых {ex.rest} сек</span>
          {isAssist && <span className="badge">больше помощь = легче</span>}
        </div>
      </div>

      <ExercisePhoto srcs={photos} alt={ex.name} note={isAssist ? 'На фото без гравитрона. В гравитроне то же движение, колени на подушке.' : undefined} />

      {ex.ankle && (
        <div className="alert warn">
          <b>*</b> Только если голеностоп не болит: боль ≤ 3/10 и утром не хуже.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={skip}>Пропустить (болит нога)</button></div>
        </div>
      )}

      {(prev.length > 0 || hint) && (
        <div className="card tight stack" style={{ gap: 6 }}>
          {prev.length > 0 && (
            <div className="small"><span className="muted">Прошлый раз: </span>
              <b className="num">{prev.map((x) => (ex.bodyweight ? `${x.reps}` : `${fmtKg(x.weight)}×${x.reps}`)).join(', ')}{ex.timed ? ' сек' : ''}</b>
            </div>
          )}
          {hint && <div className="small" style={{ color: hint.add ? 'var(--ok)' : 'var(--muted)' }}>{hint.add ? '↑ ' : ''}{hint.text}</div>}
        </div>
      )}

      {done.length > 0 && (
        <div className="row wrap">
          {done.map((x, k) => <span key={k} className="badge ok num">{k + 1}: {ex.bodyweight ? '' : `${fmtKg(x.weight)} кг × `}{x.reps}{ex.timed ? ' с' : ''}</span>)}
          <button className="btn sm ghost" onClick={removeLast}>Убрать последний</button>
        </div>
      )}

      {!ex.bodyweight && <Stepper label={wLabel} value={weight} onChange={setWeight} step={ex.legs ? 2.5 : 1} />}

      {ex.timed ? (
        <WorkTimer target={reps} setTarget={setReps} running={work} setRunning={setWork} onDone={logSet} />
      ) : (
        <Stepper label={ex.perSide ? 'Повторы (на каждую сторону)' : 'Повторы'} value={reps} onChange={(n) => setReps(Math.round(n))} />
      )}

      {!ex.timed && (
        allDone ? (
          <div className="stack">
            <button className="btn huge primary" onClick={() => go(1)}>{a.index + 1 >= list.length ? 'Закончить тренировку' : 'Следующее упражнение →'}</button>
            <button className="btn block" onClick={() => logSet(reps)}>Ещё подход</button>
          </div>
        ) : (
          <button className="btn huge primary" onClick={() => logSet(reps)}>Подход сделан ({done.length + 1} из {ex.sets})</button>
        )
      )}
      {ex.timed && allDone && (
        <button className="btn huge primary" onClick={() => go(1)}>{a.index + 1 >= list.length ? 'Закончить тренировку' : 'Следующее упражнение →'}</button>
      )}

      <section className="card">
        <div className="card-title">Техника</div>
        <ul className="tips">{ex.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="alert bad small" style={{ marginTop: 12 }}><b>Главная ошибка:</b> {ex.mistake}</div>
      </section>

      <div className="row">
        <button className="btn grow" disabled={a.index === 0} onClick={() => go(-1)}>← Назад</button>
        {!ex.ankle && <button className="btn grow" onClick={skip}>Пропустить</button>}
        <button className="btn grow" onClick={() => update((st) => { if (st.active) st.active.stage = 'finish'; })}>Завершить</button>
      </div>

      {rest && <RestOverlay end={rest} next={nextName} onAdd={() => setRest((r) => (r ?? Date.now()) + 15000)} onDone={() => setRest(null)} />}
    </div>
  );
}

function WorkTimer({ target, setTarget, running, setRunning, onDone }: {
  target: number; setTarget: (n: number) => void; running: number | null; setRunning: (n: number | null) => void; onDone: (sec: number) => void;
}) {
  const now = useNow(200);
  const elapsed = running ? (now - running) / 1000 : 0;
  const left = target - elapsed;
  const fired = useRef(false);
  useEffect(() => {
    if (running && left <= 0 && !fired.current) { fired.current = true; beep(); setRunning(null); onDone(target); }
    if (!running) fired.current = false;
  }, [left, running, target, onDone, setRunning]);
  if (!running) {
    return (
      <div className="stack">
        <Stepper label="Время работы, сек" value={target} onChange={(n) => setTarget(Math.round(n))} step={5} />
        <button className="btn huge primary" onClick={() => setRunning(Date.now())}>Старт</button>
      </div>
    );
  }
  return (
    <div className="card center stack">
      <p className="muted">Держи!</p>
      <div className="timer-num">{fmtSec(left)}</div>
      <button className="btn huge" onClick={() => { fired.current = true; setRunning(null); onDone(Math.round(elapsed)); }}>Стоп ({Math.round(elapsed)} сек)</button>
    </div>
  );
}

// ---------------- Бассейн ----------------
function PoolRun({ a }: { a: ActiveWorkout }) {
  const segs = POOL.segments;
  const g = segs[a.index];
  const total = g.reps + (a.poolExtra[g.id] ?? 0);
  const done = a.poolDone[g.id] ?? 0;
  const [rest, setRest] = useState<number | null>(null);
  const meters = segs.reduce((m, x) => m + (a.poolDone[x.id] ?? 0) * x.meters, 0);

  const mark = () => {
    update((st) => { if (st.active) st.active.poolDone[g.id] = done + 1; });
    if (done + 1 < total && g.rest) setRest(Date.now() + g.rest * 1000);
  };
  const go = (d: number) => update((st) => {
    if (!st.active) return;
    const i = st.active.index + d;
    if (i >= segs.length) st.active.stage = 'finish'; else st.active.index = Math.max(0, i);
  });

  return (
    <div className="stack-lg">
      <TopBar a={a} i={a.index} n={segs.length} label="Блок" />
      <div className="stack" style={{ gap: 6 }}>
        <h1 style={{ fontSize: 26 }}>{g.name}</h1>
        <div className="row wrap">
          <span className="badge accent">{total > 1 ? `${total}×${g.meters} м` : `${g.meters} м`}</span>
          {g.rest > 0 && total > 1 && <span className="badge">отдых {g.rest} сек</span>}
        </div>
        {g.note && <div className="alert warn small">{g.note}</div>}
      </div>
      <div className="card center">
        <div className="big-num">{done} / {total}</div>
        <p className="muted small">отрезков · всего проплыл {meters} м</p>
      </div>
      {done < total ? (
        <button className="btn huge primary" onClick={mark}>Отрезок сделан ({done + 1} из {total})</button>
      ) : (
        <button className="btn huge primary" onClick={() => go(1)}>{a.index + 1 >= segs.length ? 'Закончить' : 'Дальше →'}</button>
      )}
      <div className="row">
        <button className="btn grow" disabled={a.index === 0} onClick={() => go(-1)}>← Назад</button>
        {total > 1 && <button className="btn grow" onClick={() => update((st) => { if (st.active) st.active.poolExtra[g.id] = (st.active.poolExtra[g.id] ?? 0) + 1; })}>+1 отрезок</button>}
        <button className="btn grow" onClick={() => update((st) => { if (st.active) st.active.stage = 'finish'; })}>Завершить</button>
      </div>
      <ul className="tips small muted">{POOL.rules.map((r) => <li key={r}>{r}</li>)}</ul>
      {rest && <RestOverlay end={rest} next={`${g.name}, отрезок ${done + 1}`} onAdd={() => setRest((r) => (r ?? Date.now()) + 15000)} onDone={() => setRest(null)} />}
    </div>
  );
}

// ---------------- Итог ----------------
function Finish({ s, a }: { s: AppState; a: ActiveWorkout }) {
  const [endedAt] = useState(Date.now());
  const [pain, setPain] = useState<Pain>({ leg: 0, back: 0, neck: 0 });
  const [kcal, setKcal] = useState('');
  const meters = POOL.segments.reduce((m, x) => m + (a.poolDone[x.id] ?? 0) * x.meters, 0);
  const min = Math.round((endedAt - a.startedAt) / 60000);
  const lastLeg = s.workouts[s.workouts.length - 1]?.pain.leg;

  const save = () => update((st) => {
    st.workouts.push({
      id: uid(), date: todayStr(), type: a.type, startedAt: a.startedAt, endedAt, sets: a.sets, skipped: a.skipped, pain,
      watchKcal: kcal ? Number(kcal) : undefined, poolMeters: a.type === 'pool' ? meters : undefined,
    });
    st.active = undefined;
  });

  const maxPain = Math.max(pain.leg, pain.back, pain.neck);
  return (
    <div className="stack-lg">
      <h1>Готово! 🎉</h1>
      <div className="row">
        <div className="card grow center"><div className="big-num">{min}</div><div className="small muted">минут</div></div>
        <div className="card grow center">
          <div className="big-num">{a.type === 'pool' ? meters : a.sets.length}</div>
          <div className="small muted">{a.type === 'pool' ? 'метров' : 'подходов'}</div>
        </div>
      </div>
      {a.skipped.length > 0 && <p className="small muted">Пропущено упражнений: {a.skipped.length}</p>}

      <section className="card stack">
        <div className="card-title">Боль сейчас, 0–10</div>
        {([['leg', 'Нога'], ['back', 'Спина'], ['neck', 'Шея']] as const).map(([k, l]) => (
          <div key={k} className="pain-row">
            <span>{l}</span>
            <input type="range" min={0} max={10} value={pain[k]} onChange={(e) => setPain({ ...pain, [k]: Number(e.target.value) })} aria-label={l} />
            <b className="num" style={{ color: pain[k] > 3 ? 'var(--bad)' : undefined }}>{pain[k]}</b>
          </div>
        ))}
        {maxPain >= 7 && <div className="alert bad small">Сильная боль. Если она отдаёт в руку/ногу, есть онемение или отёк — иди к врачу, не тренируйся.</div>}
        {maxPain > 3 && maxPain < 7 && <div className="alert warn small">Боль выше 3/10. В следующий раз уменьши вес или пропусти упражнения на эту зону. Если утром хуже — к травматологу.</div>}
        {lastLeg !== undefined && pain.leg > lastLeg && pain.leg > 2 && <div className="alert warn small">Нога болит сильнее, чем в прошлый раз ({lastLeg} → {pain.leg}).</div>}
      </section>

      <section className="card stack">
        <div className="field">
          <label>Калории с Apple Watch (активные)</label>
          <input className="input" inputMode="numeric" placeholder="например, 320" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ''))} />
        </div>
        <p className="small muted">Веб-приложение не может читать Apple Health напрямую — посмотри цифру в «Активность» на часах и введи вручную.</p>
      </section>

      <button className="btn huge primary" onClick={save}>Сохранить тренировку</button>
      <button className="btn block ghost" onClick={() => update((st) => { if (st.active) st.active.stage = 'exercise'; })}>← Вернуться к упражнениям</button>
    </div>
  );
}
