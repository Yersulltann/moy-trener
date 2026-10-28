import { ReactNode, useEffect, useRef, useState } from 'react';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet stack" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row-between">
          <h2>{title}</h2>
          <button className="btn sm ghost" onClick={onClose}>Закрыть</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; label: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="stepper">
        <button className="btn" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label={`${label}: меньше`}>−</button>
        <input className="input" inputMode="decimal" value={Number.isFinite(value) ? String(value) : ''}
          onChange={(e) => { const v = parseFloat(e.target.value.replace(',', '.')); onChange(Number.isFinite(v) ? v : 0); }} />
        <button className="btn" onClick={() => onChange(+(value + step).toFixed(2))} aria-label={`${label}: больше`}>+</button>
      </div>
    </div>
  );
}

export function Ring({ value, max, size = 140, stroke = 14, color = 'var(--accent)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.min(1, max ? value / max : 0);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset .4s' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export interface Series { name: string; color: string; points: { x: number; y: number }[]; dots?: boolean; dashed?: boolean; width?: number }

/** Простой линейный график. x — числа (например, дни), xLabel — подпись по x */
export function LineChart({ series, height = 180, yMin, yMax, hLines = [], xLabel, bars }: {
  series: Series[]; height?: number; yMin?: number; yMax?: number;
  hLines?: { y: number; label: string; color: string }[]; xLabel?: (x: number) => string; bars?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const all = series.flatMap((s) => s.points);
  if (!all.length) return <div ref={ref} className="muted small center" style={{ padding: 24 }}>Пока нет данных</div>;
  const xs = all.map((p) => p.x), ys = [...all.map((p) => p.y), ...hLines.map((h) => h.y)];
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08; y0 = yMin ?? y0 - pad; y1 = yMax ?? y1 + pad;
  const L = 34, R = 8, T = 8, B = 20;
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (w - L - R);
  const sy = (y: number) => T + (1 - (y - y0) / (y1 - y0)) * (height - T - B);
  const ticks = [y0, (y0 + y1) / 2, y1];
  const xt = [x0, (x0 + x1) / 2, x1].map(Math.round);
  const bw = bars ? Math.max(4, Math.min(24, (w - L - R) / Math.max(1, all.length) - 4)) : 0;
  return (
    <div ref={ref}>
      <svg className="chart" width={w} height={height} role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={w - R} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
            <text x={L - 4} y={sy(t) + 3} textAnchor="end">{Math.round(t * 10) / 10}</text>
          </g>
        ))}
        {xLabel && xt.map((x, i) => <text key={i} x={sx(x)} y={height - 4} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{xLabel(x)}</text>)}
        {hLines.map((h, i) => (
          <g key={i}>
            <line x1={L} x2={w - R} y1={sy(h.y)} y2={sy(h.y)} stroke={h.color} strokeDasharray="4 4" />
            <text x={w - R} y={sy(h.y) - 3} textAnchor="end" style={{ fill: h.color }}>{h.label}</text>
          </g>
        ))}
        {series.map((s) => bars ? s.points.map((p, i) => (
          <rect key={s.name + i} x={sx(p.x) - bw / 2} y={sy(p.y)} width={bw} height={Math.max(0, sy(y0) - sy(p.y))} rx={3} fill={s.color} />
        )) : (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round"
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
            {s.dots && s.points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={s.color} />)}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="row wrap small muted" style={{ gap: 12, marginTop: 4 }}>
          {series.map((s) => <span key={s.name} className="row" style={{ gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.name}</span>)}
        </div>
      )}
    </div>
  );
}

const I = (d: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
export const Icons = {
  today: I(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  workout: I(<><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" /></>),
  food: I(<><path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v8a2 2 0 0 1-2 2M17 2c-1.7 1.3-2.5 3.5-2.5 6s1 4 2.5 4v10" /></>),
  schedule: I(<><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>),
  progress: I(<><path d="M3 20h18M5 16l4-5 4 3 6-8" /></>),
};

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

export function fmtSec(s: number) {
  s = Math.max(0, Math.round(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

let audioCtx: AudioContext | null = null;
/** Звук + вибрация (на iPhone вибрация из браузера не работает — будет только звук) */
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* без звука */ }
  try { navigator.vibrate?.([300, 150, 300]); } catch { /* нет вибрации */ }
}
/** iOS разрешает звук только после касания — «разблокируем» при первом нажатии */
export function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* ignore */ }
}

export function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: any = null, dead = false;
    const req = async () => { try { lock = await (navigator as any).wakeLock.request('screen'); } catch { /* отказано */ } };
    req();
    const vis = () => { if (document.visibilityState === 'visible' && !dead) req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release?.(); };
  }, [on]);
}
