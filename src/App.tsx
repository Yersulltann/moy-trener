import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Icons, unlockAudio } from './components/ui';
import Today from './screens/Today';
import WorkoutScreen from './screens/Workout';
import Nutrition from './screens/Nutrition';
import Schedule from './screens/Schedule';
import Progress from './screens/Progress';

export type Tab = 'today' | 'workout' | 'food' | 'schedule' | 'progress';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'today', label: 'Сегодня', icon: Icons.today },
  { id: 'workout', label: 'Тренировка', icon: Icons.workout },
  { id: 'food', label: 'Питание', icon: Icons.food },
  { id: 'schedule', label: 'Расписание', icon: Icons.schedule },
  { id: 'progress', label: 'Прогресс', icon: Icons.progress },
];

export default function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>(() => (s.active ? 'workout' : 'today'));

  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.theme);
  }, [s.theme]);

  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  return (
    <div className="app" onPointerDown={unlockAudio}>
      {tab === 'today' && <Today go={setTab} />}
      {tab === 'workout' && <WorkoutScreen />}
      {tab === 'food' && <Nutrition />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'progress' && <Progress />}
      <nav className="nav">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
