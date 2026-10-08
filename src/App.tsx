import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, configured } from './lib/supabase';
import { DataProvider, useData } from './lib/store';
import { NavCtx, type FormState, type Nav, type Page, type Tab } from './lib/nav';
import { Icon, Toast } from './components/ui';
import { Auth, ConfigMissing } from './screens/Auth';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Tasks } from './screens/Tasks';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { TaskDetail } from './screens/TaskDetail';
import { TaskForm } from './screens/TaskForm';
import { Leaderboard } from './screens/Leaderboard';

function Shell() {
  const d = useData();
  const [tab, setTabState] = useState<Tab>('today');
  const [page, setPage] = useState<Page>(null);
  const [form, setForm] = useState<FormState>(null);

  const setTab = useCallback((t: Tab) => { setPage(null); setTabState(t); }, []);

  const nav: Nav = useMemo(() => ({
    tab, setTab, page,
    openTask: (id) => setPage({ type: 'task', id }),
    openLeaderboard: () => setPage({ type: 'leaderboard' }),
    closePage: () => setPage(null),
    openForm: (taskId) => setForm({ taskId }),
    closeForm: () => setForm(null),
  }), [tab, page, setTab]);

  // Deep Links aus Push-Benachrichtigungen (#/task/<id>, #/today)
  useEffect(() => {
    const handle = (hash: string) => {
      const m = hash.match(/#\/task\/([0-9a-f-]+)/i);
      if (m) { setTabState('today'); setPage({ type: 'task', id: m[1] }); }
      else if (hash.startsWith('#/today')) { setTabState('today'); setPage(null); }
    };
    handle(window.location.hash);
    const onHash = () => handle(window.location.hash);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string') {
        const i = e.data.url.indexOf('#');
        if (i >= 0) handle(e.data.url.slice(i));
        void d.reload();
      }
    };
    window.addEventListener('hashchange', onHash);
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('hashchange', onHash);
      navigator.serviceWorker?.removeEventListener('message', onMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (d.status === 'loading') return <div className="center-screen"><div className="spinner" /></div>;
  if (d.status === 'error' && !d.household) {
    return (
      <div className="center-screen">
        <div className="hero-emoji">📡</div>
        <h1 className="large">Keine Verbindung</h1>
        <p className="muted">{d.error}</p>
        <button className="btn primary" onClick={() => void d.reload()}>Erneut versuchen</button>
      </div>
    );
  }
  if (!d.me) return <Onboarding />;

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'today', label: 'Heute', icon: <Icon.today /> },
    { id: 'tasks', label: 'Aufgaben', icon: <Icon.list /> },
    { id: 'stats', label: 'Statistik', icon: <Icon.chart /> },
    { id: 'settings', label: 'Einstellungen', icon: <Icon.gear /> },
  ];

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        {!d.online && <div className="offline-bar">Offline – gecachte Daten</div>}
        <main className="content">
          {page?.type === 'task' ? <TaskDetail occId={page.id} />
            : page?.type === 'leaderboard' ? <Leaderboard />
            : tab === 'today' ? <Today />
            : tab === 'tasks' ? <Tasks />
            : tab === 'stats' ? <Stats />
            : <Settings />}
        </main>

        {!page && (tab === 'today' || tab === 'tasks') && (
          <button className="fab" aria-label="Neue Aufgabe" onClick={() => setForm({})}><Icon.plus /></button>
        )}

        <nav className="tabbar">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>
        {form && <TaskForm taskId={form.taskId} />}
        <Toast />
      </div>
    </NavCtx.Provider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!configured) { setSession(null); return; }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured) return <ConfigMissing />;
  if (session === undefined) return <div className="center-screen"><div className="spinner" /></div>;
  if (!session) return <Auth />;
  return (
    <DataProvider key={session.user.id} user={session.user}>
      <Shell />
    </DataProvider>
  );
}
