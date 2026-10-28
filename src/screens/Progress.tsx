import { useRef, useState } from 'react';
import { PROFILE } from '../data/profile';
import { POOL, STAGE, WORKOUT_LABEL, WORKOUTS } from '../data/program';
import { bestSet, exerciseById, kcalSuggestion } from '../plan';
import {
  addDays, AppState, avgWeight, dayTotals, daysBetween, exportJSON, fmtDate, fmtKg, importJSON, parseDate, resetAll,
  sortedWeights, todayStr, update, useStore,
} from '../store';
import { LineChart, Sheet, Stepper } from '../components/ui';

const dayNum = (d: string) => Math.round(parseDate(d).getTime() / 86400000);
const fromDayNum = (n: number) => fmtDate(new Date(n * 86400000).toISOString().slice(0, 10));

export default function Progress() {
  const s = useStore();
  const [report, setReport] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  return (
    <div className="stack-lg">
      <header className="row-between">
        <h1>Прогресс</h1>
        <button className="btn sm" onClick={() => setSettings(true)}>Настройки</button>
      </header>
      <button className="btn huge primary" onClick={() => setReport(buildReport(s))}>Отчёт для тренера</button>
      <KcalAdvice s={s} />
      <Weight s={s} />
      <Strength s={s} />
      <PainChart s={s} />
      <PoolChart s={s} />
      <Measurements s={s} />
      {report && <Report text={report} onClose={() => setReport(null)} />}
      {settings && <Settings s={s} onClose={() => setSettings(false)} />}
    </div>
  );
}

function KcalAdvice({ s }: { s: AppState }) {
  const sug = kcalSuggestion(s);
  if (!sug) return null;
  const change = sug.to !== s.profile.kcal;
  return (
    <div className={`alert ${change ? 'warn' : 'ok'}`}>
      <b>Проверка за 2 недели.</b> {sug.text}
      {change && <div className="small" style={{ marginTop: 4 }}>Сейчас {s.profile.kcal} → новая цель {sug.to} ккал.</div>}
      <div className="row" style={{ marginTop: 10 }}>
        {change && (
          <button className="btn sm primary" onClick={() => update((st) => {
            st.kcalChanges.push({ date: todayStr(), from: st.profile.kcal, to: sug.to, reason: sug.text });
            st.profile.kcal = sug.to;
            st.profile.carbs = Math.round(st.profile.carbs + (sug.to - s.profile.kcal) / 4);
          })}>Применить новую цель</button>
        )}
        <button className="btn sm" onClick={() => update((st) => { st.kcalCheckDismissed = todayStr(); })}>{change ? 'Не сейчас' : 'Ок'}</button>
      </div>
    </div>
  );
}

function Weight({ s }: { s: AppState }) {
  const list = sortedWeights(s);
  const last = list[list.length - 1];
  const [kg, setKg] = useState(last?.kg ?? PROFILE.weightKg);
  const [showAll, setShowAll] = useState(false);
  const today = todayStr();
  const hasToday = list.some((w) => w.date === today);
  const pts = list.map((w) => ({ x: dayNum(w.date), y: w.kg }));
  const avg = list.map((w) => ({ x: dayNum(w.date), y: avgWeight(s, addDays(w.date, -6), w.date).avg }));
  const save = () => update((st) => {
    st.weights = st.weights.filter((w) => w.date !== today);
    st.weights.push({ date: today, kg });
  });
  return (
    <section className="card stack">
      <div className="row-between">
        <div className="card-title" style={{ margin: 0 }}>Вес</div>
        <span className="small muted">цель {PROFILE.goalNearKg.join('–')} кг к марту 2027, потом {PROFILE.goalFinalKg}</span>
      </div>
      <LineChart series={[{ name: 'Вес', color: 'var(--muted)', points: pts, dots: true, width: 1 }, { name: 'Среднее 7 дней', color: 'var(--accent)', points: avg, width: 3 }]}
        hLines={[{ y: 68.5, label: '68–69', color: 'var(--ok)' }]} xLabel={fromDayNum} height={190} />
      <p className="small muted">Взвешивайся 3–4 раза в неделю утром, после туалета, до еды. Линия 80 кг — дальняя цель, она за пределами графика.</p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><Stepper label={hasToday ? 'Вес сегодня (обновить)' : 'Вес сегодня утром, кг'} value={kg} onChange={setKg} step={0.1} /></div>
      </div>
      <button className="btn block primary" onClick={save}>{hasToday ? 'Обновить' : 'Записать вес'}</button>
      <button className="btn sm ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Скрыть записи' : `Все записи (${list.length})`}</button>
      {showAll && (
        <div className="list">
          {[...list].reverse().map((w) => (
            <div key={w.date} className="list-item small">
              <span className="grow">{fmtDate(w.date)}</span><b className="num">{fmtKg(w.kg)} кг</b>
              <button className="btn sm ghost" aria-label="Удалить" onClick={() => update((st) => { st.weights = st.weights.filter((x) => x.date !== w.date); })}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Strength({ s }: { s: AppState }) {
  const main = ['bench', 'db-bench', 'leg-press', 'lat-pulldown', 'db-ohp', 'cable-row', 'db-row', 'hip-thrust', 'goblet-squat'];
  const [ex, setEx] = useState(main[0]);
  const pts = s.workouts.map((w) => ({ w, b: bestSet(w.sets.filter((x) => x.exId === ex)) })).filter((x) => x.b);
  const last = pts[pts.length - 1];
  return (
    <section className="card stack">
      <div className="card-title" style={{ margin: 0 }}>Сила · лучший подход</div>
      <select className="input" value={ex} onChange={(e) => setEx(e.target.value)} aria-label="Упражнение">
        {main.map((id) => <option key={id} value={id}>{exerciseById(id)?.name}</option>)}
      </select>
      <LineChart series={[{ name: 'Вес', color: 'var(--accent)', points: pts.map((p) => ({ x: dayNum(p.w.date), y: p.b!.weight })), dots: true }]} xLabel={fromDayNum} height={160} />
      {last && <p className="small">Последний лучший: <b className="num">{fmtKg(last.b!.weight)} кг × {last.b!.reps}</b> · {fmtDate(last.w.date)}</p>}
    </section>
  );
}

function PainChart({ s }: { s: AppState }) {
  const list = s.workouts.slice(-20);
  const mk = (k: 'leg' | 'back' | 'neck') => list.map((w, i) => ({ x: i + 1, y: w.pain[k] }));
  const rising = (['leg', 'back', 'neck'] as const).filter((k) => {
    const v = s.workouts.slice(-3).map((w) => w.pain[k]);
    return v.length === 3 && v[2] > v[1] && v[1] > v[0] && v[2] >= 3;
  });
  const names = { leg: 'нога', back: 'спина', neck: 'шея' };
  return (
    <section className="card stack">
      <div className="card-title" style={{ margin: 0 }}>Боль по тренировкам</div>
      {rising.length > 0 && <div className="alert bad small">Боль растёт 3 тренировки подряд: {rising.map((k) => names[k]).join(', ')}. Уменьши нагрузку и покажись травматологу/физиотерапевту.</div>}
      <LineChart series={[{ name: 'Нога', color: 'var(--bad)', points: mk('leg'), dots: true }, { name: 'Спина', color: 'var(--warn)', points: mk('back'), dots: true }, { name: 'Шея', color: 'var(--class)', points: mk('neck'), dots: true }]}
        yMin={0} yMax={10} hLines={[{ y: 3, label: 'порог 3', color: 'var(--muted)' }]} height={150} />
    </section>
  );
}

function PoolChart({ s }: { s: AppState }) {
  const list = s.workouts.filter((w) => w.type === 'pool');
  if (!list.length) return null;
  return (
    <section className="card stack">
      <div className="card-title" style={{ margin: 0 }}>Бассейн · метры</div>
      <LineChart bars series={[{ name: 'Метры', color: 'var(--pool)', points: list.map((w) => ({ x: dayNum(w.date), y: w.poolMeters ?? 0 })) }]} yMin={0} xLabel={fromDayNum} height={150} />
    </section>
  );
}

function Measurements({ s }: { s: AppState }) {
  const last = s.measurements[s.measurements.length - 1];
  const due = !last || daysBetween(last.date, todayStr()) >= 30;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ waist: last?.waist ?? 0, chest: last?.chest ?? 0, arm: last?.arm ?? 0, thigh: last?.thigh ?? 0 });
  const L = { waist: 'Талия', chest: 'Грудь', arm: 'Плечо (бицепс)', thigh: 'Бедро' } as const;
  return (
    <section className="card stack">
      <div className="row-between">
        <div className="card-title" style={{ margin: 0 }}>Замеры, см</div>
        {due && <span className="badge warn">пора замерить</span>}
      </div>
      {s.measurements.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="small num" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr className="muted"><th align="left">Дата</th><th>Талия</th><th>Грудь</th><th>Плечо</th><th>Бедро</th></tr></thead>
            <tbody>{[...s.measurements].reverse().map((m) => (
              <tr key={m.date}><td>{fmtDate(m.date)}</td><td align="center">{m.waist}</td><td align="center">{m.chest}</td><td align="center">{m.arm}</td><td align="center">{m.thigh}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {!open ? <button className="btn block" onClick={() => setOpen(true)}>Записать замеры</button> : (
        <div className="stack">
          {(Object.keys(L) as (keyof typeof L)[]).map((k) => <Stepper key={k} label={L[k]} value={v[k]} step={0.5} onChange={(n) => setV({ ...v, [k]: n })} />)}
          <p className="small muted">Утром, до еды, лента без натяжения. Плечо — расслабленная рука, самое широкое место.</p>
          <button className="btn block primary" onClick={() => { update((st) => { st.measurements = st.measurements.filter((m) => m.date !== todayStr()); st.measurements.push({ date: todayStr(), ...v }); }); setOpen(false); }}>Сохранить</button>
        </div>
      )}
    </section>
  );
}

// ---------------- Отчёт ----------------
function buildReport(s: AppState): string {
  const today = todayStr(), from = addDays(today, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const w = avgWeight(s, from, today), wPrev = avgWeight(s, addDays(from, -7), addDays(from, -1));
  const food = days.filter((d) => (s.meals[d] || []).length).map((d) => dayTotals(s, d));
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const wk = s.workouts.filter((x) => x.date >= from);
  const sleep = days.map((d) => s.sleep[d]).filter((x): x is number => x !== undefined);
  const lines: string[] = [];
  lines.push(`ОТЧЁТ ДЛЯ ТРЕНЕРА · ${fmtDate(from)} – ${fmtDate(today)}`);
  lines.push(`${STAGE.title}`);
  lines.push('');
  lines.push(`Вес: ${w.n ? `${fmtKg(w.avg)} кг в среднем (${w.n} взвеш.)` : 'нет взвешиваний'}${wPrev.n && w.n ? `, неделей раньше ${fmtKg(wPrev.avg)} (${w.avg - wPrev.avg >= 0 ? '+' : ''}${fmtKg(w.avg - wPrev.avg)})` : ''}`);
  lines.push(`Питание: ${food.length ? `${avg(food.map((x) => x.kcal))} ккал, ${avg(food.map((x) => x.p))} г белка в среднем; записано дней ${food.length}/7; приёмов в день ~${(food.reduce((a, x) => a + x.slots, 0) / food.length).toFixed(1)}` : 'нет записей'}`);
  lines.push(`Цель сейчас: ${s.profile.kcal} ккал, белок ${s.profile.proteinMin}–${s.profile.proteinMax} г`);
  lines.push(`Сон: ${sleep.length ? `${(sleep.reduce((a, x) => a + x, 0) / sleep.length).toFixed(1)} ч в среднем (${sleep.length} ноч.)` : 'нет данных'}`);
  lines.push('');
  lines.push(`Тренировки (${wk.length}):`);
  if (!wk.length) lines.push('— не было');
  for (const x of wk) {
    const mins = Math.round((x.endedAt - x.startedAt) / 60000);
    lines.push(`• ${fmtDate(x.date)} ${WORKOUT_LABEL[x.type]}, ${mins} мин${x.watchKcal ? `, ${x.watchKcal} ккал (часы)` : ''} · боль нога ${x.pain.leg}, спина ${x.pain.back}, шея ${x.pain.neck}`);
    if (x.type === 'pool') {
      lines.push(`  ${x.poolMeters} м`);
      continue;
    }
    for (const e of WORKOUTS[x.type].exercises) {
      const sets = x.sets.filter((z) => z.exId === e.id);
      if (x.skipped.includes(e.id)) { lines.push(`  ${e.name}: пропущено`); continue; }
      if (!sets.length) continue;
      lines.push(`  ${e.name}: ${sets.map((z) => (e.bodyweight ? `${z.reps}` : `${fmtKg(z.weight)}×${z.reps}`)).join(', ')}${e.timed ? ' сек' : ''}`);
    }
  }
  const pool = wk.filter((x) => x.type === 'pool').reduce((a, x) => a + (x.poolMeters ?? 0), 0);
  lines.push('');
  lines.push(`Бассейн за неделю: ${pool} м (план: ${POOL.segments.reduce((a, g) => a + g.meters * g.reps, 0)} м за тренировку)`);
  const lastM = s.measurements[s.measurements.length - 1];
  if (lastM) lines.push(`Замеры (${fmtDate(lastM.date)}): талия ${lastM.waist}, грудь ${lastM.chest}, плечо ${lastM.arm}, бедро ${lastM.thigh}`);
  lines.push('');
  lines.push('Комментарий: ');
  return lines.join('\n');
}

function Report({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const v = ref.current?.value ?? text;
    try { await navigator.clipboard.writeText(v); } catch { ref.current?.select(); document.execCommand('copy'); }
    setCopied(true);
  };
  return (
    <Sheet title="Отчёт для тренера" onClose={onClose}>
      <p className="small muted">Допиши комментарий (самочувствие, что было тяжело), скопируй и пришли мне в чат.</p>
      <textarea ref={ref} className="input" defaultValue={text} style={{ minHeight: 320 }} />
      <button className="btn huge primary" onClick={copy}>{copied ? 'Скопировано ✓' : 'Скопировать'}</button>
    </Sheet>
  );
}

// ---------------- Настройки ----------------
function Settings({ s, onClose }: { s: AppState; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const P = s.profile;
  const set = (k: keyof AppState['profile'], v: number) => update((st) => { st.profile[k] = v; });
  const download = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `moy-trener-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    try { importJSON(await f.text()); setMsg('Данные восстановлены ✓'); } catch (e) { setMsg('Не получилось: ' + (e as Error).message); }
  };
  return (
    <Sheet title="Настройки" onClose={onClose}>
      <div className="field">
        <label>Тема</label>
        <div className="segmented">
          {([['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']] as const).map(([k, l]) => (
            <button key={k} className={s.theme === k ? 'on' : ''} onClick={() => update((st) => { st.theme = k; })}>{l}</button>
          ))}
        </div>
      </div>
      <h3>Цели питания</h3>
      <Stepper label="Калории, ккал" value={P.kcal} step={50} onChange={(n) => set('kcal', Math.round(n))} />
      <div className="row">
        <div className="grow"><Stepper label="Белок от, г" value={P.proteinMin} step={5} onChange={(n) => set('proteinMin', Math.round(n))} /></div>
        <div className="grow"><Stepper label="до, г" value={P.proteinMax} step={5} onChange={(n) => set('proteinMax', Math.round(n))} /></div>
      </div>
      <div className="row">
        <div className="grow"><Stepper label="Жиры, г" value={P.fat} step={5} onChange={(n) => set('fat', Math.round(n))} /></div>
        <div className="grow"><Stepper label="Углеводы, г" value={P.carbs} step={10} onChange={(n) => set('carbs', Math.round(n))} /></div>
      </div>
      <Stepper label="Рост, см" value={P.heightCm} onChange={(n) => set('heightCm', Math.round(n))} />
      {s.kcalChanges.length > 0 && (
        <p className="small muted">Изменения калорий: {s.kcalChanges.map((c) => `${fmtDate(c.date)}: ${c.from}→${c.to}`).join('; ')}</p>
      )}

      <h3>Резервная копия</h3>
      <p className="small muted">Данные хранятся только на этом телефоне. Делай копию раз в неделю — сохрани файл в «Файлы» или iCloud.</p>
      <button className="btn block" onClick={download}>Экспорт в JSON</button>
      <button className="btn block" onClick={() => fileRef.current?.click()}>Импорт из JSON</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {msg && <div className="alert info small">{msg}</div>}

      <h3>Apple Watch</h3>
      <p className="small muted">Веб-приложение не может читать Apple Health. Калории тренировки вводятся вручную в конце тренировки. Позже можно сделать автоматизацию через «Команды» (iOS Shortcuts).</p>

      <button className="btn block danger" onClick={() => { if (confirm('Стереть ВСЕ данные? Сначала сделай экспорт.')) { resetAll(); onClose(); } }}>Стереть все данные</button>
    </Sheet>
  );
}
