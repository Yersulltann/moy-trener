import { useMemo, useState } from 'react';
import { Food, MEAL_LABEL, MEAL_ORDER, MealSlot, SAMPLE_DAY } from '../data/foods';
import { addDays, allFoods, AppState, dayTotals, entryFrom, fmtDate, todayStr, uid, update, useStore } from '../store';
import { Sheet, Stepper } from '../components/ui';

type Status = 'low' | 'ok' | 'high';
const STATUS_LABEL: Record<Status, string> = { low: 'мало', ok: 'норма', high: 'перебор' };
const STATUS_CLASS: Record<Status, string> = { low: 'warn', ok: 'ok', high: 'bad' };

function status(v: number, min: number, max: number): Status {
  if (v < min) return 'low';
  if (v > max) return 'high';
  return 'ok';
}

function addItems(date: string, meal: MealSlot, items: { foodId: string; g: number }[], foods: Food[]) {
  update((s) => {
    const list = (s.meals[date] ||= []);
    for (const it of items) {
      const food = foods.find((f) => f.id === it.foodId);
      if (food) list.push(entryFrom(food, it.g, meal));
    }
  });
}

export default function Nutrition() {
  const s = useStore();
  const [date, setDate] = useState(todayStr());
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [manage, setManage] = useState(false);
  const foods = useMemo(() => allFoods(s), [s.customFoods]);
  const t = dayTotals(s, date);
  const entries = s.meals[date] || [];
  const P = s.profile;
  const isToday = date === todayStr();

  const rows: { label: string; v: number; target: string; st: Status; pct: number; unit: string }[] = [
    { label: 'Калории', v: t.kcal, target: `${P.kcal}`, st: status(t.kcal, P.kcal * 0.9, P.kcal * 1.12), pct: t.kcal / P.kcal, unit: 'ккал' },
    { label: 'Белок', v: t.p, target: `${P.proteinMin}–${P.proteinMax}`, st: status(t.p, P.proteinMin, P.proteinMax * 1.5), pct: t.p / P.proteinMin, unit: 'г' },
    { label: 'Жиры', v: t.f, target: `${P.fat}`, st: status(t.f, P.fat * 0.7, P.fat * 1.3), pct: t.f / P.fat, unit: 'г' },
    { label: 'Углеводы', v: t.c, target: `${P.carbs}`, st: status(t.c, P.carbs * 0.75, P.carbs * 1.25), pct: t.c / P.carbs, unit: 'г' },
  ];

  const saveTemplate = (meal: MealSlot) => {
    const items = entries.filter((e) => e.meal === meal && e.foodId).map((e) => ({ foodId: e.foodId!, g: e.g }));
    if (!items.length) return;
    const name = prompt('Название шаблона', `Мой ${MEAL_LABEL[meal].toLowerCase()}`);
    if (!name) return;
    update((st) => { st.templates.push({ id: uid(), name, meal, items }); });
  };

  return (
    <div className="stack-lg">
      <header className="row-between">
        <h1>Питание</h1>
        <button className="btn sm" onClick={() => setManage(true)}>Мои продукты</button>
      </header>

      <div className="row-between">
        <button className="btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="Предыдущий день">←</button>
        <b>{isToday ? 'Сегодня' : fmtDate(date)}</b>
        <button className="btn sm" onClick={() => setDate(addDays(date, 1))} disabled={isToday} aria-label="Следующий день">→</button>
      </div>

      <section className="card stack">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="row-between small">
              <b>{r.label}</b>
              <span className="row" style={{ gap: 6 }}>
                <span className="num">{Math.round(r.v)} / {r.target} {r.unit}</span>
                <span className={`badge ${STATUS_CLASS[r.st]}`}>{STATUS_LABEL[r.st]}</span>
              </span>
            </div>
            <div className="bar" style={{ marginTop: 6 }}>
              <div style={{ width: `${Math.min(100, r.pct * 100)}%`, background: `var(--${r.st === 'ok' ? 'ok' : r.st === 'high' ? 'bad' : 'accent'})` }} />
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <button className="btn block" onClick={() => MEAL_ORDER.forEach((m) => addItems(date, m, SAMPLE_DAY[m], foods))}>Записать весь пример дня (~3100 ккал)</button>
        )}
      </section>

      {MEAL_ORDER.map((meal) => {
        const list = entries.filter((e) => e.meal === meal);
        const kcal = list.reduce((a, e) => a + e.kcal, 0);
        const p = list.reduce((a, e) => a + e.p, 0);
        const tpls = s.templates.filter((x) => x.meal === meal);
        return (
          <section key={meal} className="card">
            <div className="row-between">
              <h3>{MEAL_LABEL[meal]}</h3>
              <span className="small muted num">{kcal} ккал · {Math.round(p)} г белка</span>
            </div>
            {list.length > 0 && (
              <div className="list" style={{ marginTop: 6 }}>
                {list.map((e) => (
                  <div key={e.id} className="list-item small">
                    <span className="grow">{e.name}<div className="muted tiny num">{e.g} г · Б {e.p} · Ж {e.f} · У {e.c}</div></span>
                    <span className="num">{e.kcal}</span>
                    <button className="btn sm ghost" aria-label={`Удалить ${e.name}`}
                      onClick={() => update((st) => { st.meals[date] = (st.meals[date] || []).filter((x) => x.id !== e.id); })}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button className="btn sm primary" onClick={() => setAdding(meal)}>+ Добавить</button>
              {list.length === 0 && <button className="btn sm" onClick={() => addItems(date, meal, SAMPLE_DAY[meal], foods)}>Из примера дня</button>}
              {tpls.map((tp) => <button key={tp.id} className="btn sm" onClick={() => addItems(date, meal, tp.items, foods)}>{tp.name}</button>)}
              {list.some((e) => e.foodId) && <button className="btn sm ghost" onClick={() => saveTemplate(meal)}>Сохранить как шаблон</button>}
            </div>
          </section>
        );
      })}

      <WeekStats s={s} />

      {adding && <AddFood meal={adding} foods={foods} onClose={() => setAdding(null)} onAdd={(food, g) => { update((st) => { (st.meals[date] ||= []).push(entryFrom(food, g, adding)); }); setAdding(null); }} />}
      {manage && <Manage s={s} onClose={() => setManage(false)} />}
    </div>
  );
}

function WeekStats({ s }: { s: AppState }) {
  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter((d) => (s.meals[d] || []).length);
  const tot = days.map((d) => dayTotals(s, d));
  const avgK = tot.length ? Math.round(tot.reduce((a, x) => a + x.kcal, 0) / tot.length) : 0;
  const avgP = tot.length ? Math.round(tot.reduce((a, x) => a + x.p, 0) / tot.length) : 0;
  const hit = tot.filter((x) => x.kcal >= s.profile.kcal * 0.9 && x.p >= s.profile.proteinMin).length;
  return (
    <section className="card">
      <div className="card-title">Неделя (7 дней)</div>
      {tot.length === 0 ? <p className="muted small">Пока нет записей.</p> : (
        <div className="row" style={{ gap: 20 }}>
          <div><div className="big-num" style={{ fontSize: 24 }}>{avgK}</div><div className="small muted">ккал в среднем</div></div>
          <div><div className="big-num" style={{ fontSize: 24 }}>{avgP}</div><div className="small muted">г белка</div></div>
          <div><div className="big-num" style={{ fontSize: 24 }}>{hit}/{tot.length}</div><div className="small muted">дней в цели</div></div>
        </div>
      )}
    </section>
  );
}

function AddFood({ meal, foods, onClose, onAdd }: { meal: MealSlot; foods: Food[]; onClose: () => void; onAdd: (f: Food, g: number) => void }) {
  const [q, setQ] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [g, setG] = useState(100);
  const [custom, setCustom] = useState(false);
  const list = foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase().trim()));

  if (custom) return <CustomFood onClose={() => setCustom(false)} onSaved={(f) => { setCustom(false); setFood(f); setG(100); }} />;

  if (food) {
    const k = g / 100;
    return (
      <Sheet title={MEAL_LABEL[meal]} onClose={onClose}>
        <h3>{food.name}</h3>
        <p className="small muted">На 100 г: {food.kcal} ккал · Б {food.p} · Ж {food.f} · У {food.c}</p>
        <Stepper label="Граммы" value={g} onChange={(n) => setG(Math.max(0, Math.round(n)))} step={10} />
        <div className="chips">
          {food.unit && [1, 2, 3].map((n) => <button key={n} className="chip" onClick={() => setG(food.unit!.g * n)}>{n} {food.unit!.name}</button>)}
          {[50, 100, 150, 200, 250].map((n) => <button key={n} className="chip" onClick={() => setG(n)}>{n} г</button>)}
        </div>
        <div className="card tight row-between">
          <b className="big-num" style={{ fontSize: 24 }}>{Math.round(food.kcal * k)} ккал</b>
          <span className="small num">Б {(food.p * k).toFixed(1)} · Ж {(food.f * k).toFixed(1)} · У {(food.c * k).toFixed(1)}</span>
        </div>
        <button className="btn huge primary" disabled={g <= 0} onClick={() => onAdd(food, g)}>Добавить</button>
        <button className="btn block ghost" onClick={() => setFood(null)}>← К списку</button>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Добавить · ${MEAL_LABEL[meal]}`} onClose={onClose}>
      <input className="input" placeholder="Поиск: курица, рис, скир…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <button className="btn block" onClick={() => setCustom(true)}>+ Свой продукт</button>
      <div className="list">
        {list.slice(0, 60).map((f) => (
          <button key={f.id} className="list-item" style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => { setFood(f); setG(f.unit?.g ?? 100); }}>
            <span className="grow">{f.name}{f.custom && <span className="badge" style={{ marginLeft: 6 }}>свой</span>}<div className="tiny muted num">Б {f.p} · Ж {f.f} · У {f.c} на 100 г</div></span>
            <span className="num small">{f.kcal}</span>
          </button>
        ))}
        {list.length === 0 && <p className="muted small" style={{ padding: 12 }}>Ничего не нашёл — добавь свой продукт.</p>}
      </div>
    </Sheet>
  );
}

function CustomFood({ onClose, onSaved }: { onClose: () => void; onSaved: (f: Food) => void }) {
  const [v, setV] = useState({ name: '', kcal: '', p: '', f: '', c: '' });
  const num = (x: string) => parseFloat(x.replace(',', '.')) || 0;
  const ok = v.name.trim() && num(v.kcal) > 0;
  const save = () => {
    const food: Food = { id: 'c-' + uid(), name: v.name.trim(), kcal: num(v.kcal), p: num(v.p), f: num(v.f), c: num(v.c), custom: true };
    update((s) => { s.customFoods.unshift(food); });
    onSaved(food);
  };
  const F = (k: keyof typeof v, label: string) => (
    <div className="field">
      <label htmlFor={`cf-${k}`}>{label}</label>
      <input id={`cf-${k}`} className="input" inputMode={k === 'name' ? 'text' : 'decimal'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </div>
  );
  return (
    <Sheet title="Свой продукт" onClose={onClose}>
      <p className="small muted">Значения на 100 г — смотри на упаковке (wartość odżywcza w 100 g).</p>
      {F('name', 'Название')}
      <div className="row">{F('kcal', 'Ккал')}{F('p', 'Белки, г')}</div>
      <div className="row">{F('f', 'Жиры, г')}{F('c', 'Углеводы, г')}</div>
      <button className="btn huge primary" disabled={!ok} onClick={save}>Сохранить продукт</button>
    </Sheet>
  );
}

function Manage({ s, onClose }: { s: AppState; onClose: () => void }) {
  return (
    <Sheet title="Мои продукты и шаблоны" onClose={onClose}>
      <h3>Шаблоны приёмов</h3>
      {s.templates.length === 0 && <p className="small muted">Добавь еду в приём пищи и нажми «Сохранить как шаблон».</p>}
      <div className="list">
        {s.templates.map((t) => (
          <div key={t.id} className="list-item">
            <span className="grow">{t.name}<div className="tiny muted">{MEAL_LABEL[t.meal]} · {t.items.length} продукт.</div></span>
            <button className="btn sm danger" onClick={() => confirm(`Удалить шаблон «${t.name}»?`) && update((st) => { st.templates = st.templates.filter((x) => x.id !== t.id); })}>Удалить</button>
          </div>
        ))}
      </div>
      <h3>Свои продукты</h3>
      {s.customFoods.length === 0 && <p className="small muted">Пока нет.</p>}
      <div className="list">
        {s.customFoods.map((f) => (
          <div key={f.id} className="list-item">
            <span className="grow">{f.name}<div className="tiny muted">{f.kcal} ккал · Б {f.p} на 100 г</div></span>
            <button className="btn sm danger" onClick={() => confirm(`Удалить «${f.name}»?`) && update((st) => { st.customFoods = st.customFoods.filter((x) => x.id !== f.id); })}>Удалить</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
