import type { Tab } from '../App';
import { WORKOUT_LABEL } from '../data/program';
import { DAY_NAMES_FULL } from '../data/schedule';
import { HEALTH_NOTES } from '../data/profile';
import { dayPlan, startWorkout, todaysWorkout } from '../plan';
import { addDays, avgWeight, dayTotals, fmtDate, fmtKg, lastWeight, todayStr, update, useStore, weekday } from '../store';
import { Ring } from '../components/ui';

export default function Today({ go }: { go: (t: Tab) => void }) {
  const s = useStore();
  const today = todayStr();
  const plan = dayPlan(s, today);
  const t = dayTotals(s, today);
  const w = lastWeight(s);
  const week = avgWeight(s, addDays(today, -6), today);
  const wt = todaysWorkout(s);
  const hour = new Date().getHours();
  const doneToday = s.workouts.filter((x) => x.date === today);
  const proteinPct = Math.min(1, t.p / s.profile.proteinMin);

  const begin = (type = wt) => {
    if (!type) return go('workout');
    if (!s.active) startWorkout(type);
    go('workout');
  };

  return (
    <div className="stack-lg">
      <header>
        <p className="muted">{DAY_NAMES_FULL[weekday(today)]}, {fmtDate(today)}</p>
        <h1>Сегодня</h1>
      </header>

      {s.active && (
        <button className="btn huge primary" onClick={() => go('workout')}>Продолжить тренировку · {WORKOUT_LABEL[s.active.type]}</button>
      )}

      {hour >= 15 && t.slots < 2 && (
        <div className="alert warn">
          <b>Ты ел только {t.slots} раз</b> — добавь перекус: скир, орехи, банан.
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => go('food')}>Записать еду</button></div>
        </div>
      )}

      <section className="card">
        <div className="card-title">План</div>
        <div className="stack">
          {plan.gym && (
            <PlanRow color="var(--gym)" title={plan.gym.title} time={`${plan.gym.start}–${plan.gym.end}`} />
          )}
          {plan.pool && <PlanRow color="var(--pool)" title="Бассейн 20–30 мин" time={`${plan.pool.start}–${plan.pool.end}`} />}
          {plan.volleyball && <PlanRow color="var(--volley)" title={plan.volleyball.title} time={`${plan.volleyball.start}–${plan.volleyball.end}`} />}
          {!plan.gym && !plan.pool && !plan.volleyball && <p className="muted">Тренировок нет — отдых и восстановление.</p>}
          {plan.classes.length > 0 && (
            <div className="list" style={{ marginTop: 4 }}>
              {plan.classes.map((c) => (
                <div key={c.id} className="list-item small">
                  <span className="num muted" style={{ width: 92 }}>{c.start}–{c.end}</span>
                  <span className="grow">{c.title}{c.online ? ' · онлайн' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {wt && !s.active && (
          <div style={{ marginTop: 14 }}>
            {doneToday.some((x) => x.type === wt) ? (
              <div className="alert ok">Тренировка {WORKOUT_LABEL[wt]} сегодня уже сделана 💪</div>
            ) : (
              <button className="btn huge primary" onClick={() => begin()}>Начать тренировку · {WORKOUT_LABEL[wt]}</button>
            )}
            {wt !== 'pool' && plan.pool && !doneToday.some((x) => x.type === 'pool') && (
              <button className="btn block" style={{ marginTop: 8 }} onClick={() => begin('pool')}>Начать бассейн</button>
            )}
          </div>
        )}
      </section>

      <section className="card" onClick={() => go('food')} style={{ cursor: 'pointer' }}>
        <div className="card-title">Питание</div>
        <div className="row" style={{ gap: 18 }}>
          <Ring value={t.kcal} max={s.profile.kcal}>
            <span className="big-num" style={{ fontSize: 26 }}>{t.kcal}</span>
            <span className="small muted">из {s.profile.kcal} ккал</span>
          </Ring>
          <div className="grow stack">
            <div>
              <div className="row-between small"><b>Белок</b><span className="num">{Math.round(t.p)} / {s.profile.proteinMin}–{s.profile.proteinMax} г</span></div>
              <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${proteinPct * 100}%`, background: t.p >= s.profile.proteinMin ? 'var(--ok)' : 'var(--accent)' }} /></div>
            </div>
            <div className="small muted">Приёмов пищи: <b style={{ color: 'var(--text)' }}>{t.slots}</b> из 4–5</div>
            <div className="small muted">Осталось: <b style={{ color: 'var(--text)' }}>{Math.max(0, s.profile.kcal - t.kcal)} ккал</b></div>
          </div>
        </div>
      </section>

      <section className="card" onClick={() => go('progress')} style={{ cursor: 'pointer' }}>
        <div className="card-title">Вес</div>
        <div className="row" style={{ gap: 24 }}>
          <div>
            <div className="big-num">{w ? fmtKg(w.kg) : '—'}<span className="small muted"> кг</span></div>
            <div className="small muted">{w ? `последний, ${fmtDate(w.date)}` : 'нет записей'}</div>
          </div>
          <div>
            <div className="big-num">{week.n ? fmtKg(week.avg) : '—'}<span className="small muted"> кг</span></div>
            <div className="small muted">среднее за 7 дней</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Сон прошлой ночью</div>
        <div className="chips">
          {[5, 6, 7, 8, 9].map((h) => (
            <button key={h} className={`chip ${s.sleep[today] === h ? 'on' : ''}`} onClick={() => update((st) => { st.sleep[today] = h; })}>{h} ч</button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Для набора массы — 7–9 часов.</p>
      </section>

      <details className="card">
        <summary style={{ fontWeight: 600, cursor: 'pointer' }}>Помни про здоровье</summary>
        <ul className="tips small" style={{ marginTop: 10 }}>
          {HEALTH_NOTES.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </details>
    </div>
  );
}

function PlanRow({ color, title, time }: { color: string; title: string; time: string }) {
  return (
    <div className="row">
      <span style={{ width: 10, height: 34, borderRadius: 4, background: color }} />
      <div className="grow"><b>{title}</b><div className="small muted num">{time}</div></div>
    </div>
  );
}
