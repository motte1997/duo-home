import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Household, Occurrence, PointEvent, Profile, Task, TaskDraft } from './types';
import { todayIn } from './dates';

type Data = {
  household: Household | null;
  members: Profile[];
  tasks: Task[];
  occs: Occurrence[];
  events: PointEvent[];
};
const EMPTY: Data = { household: null, members: [], tasks: [], occs: [], events: [] };

export type ToastMsg = { id: number; text: string; actionLabel?: string; onAction?: () => void; kind?: 'ok' | 'error' };

type Ctx = Data & {
  user: User;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  online: boolean;
  me: Profile | null;
  partner: Profile | null;
  taskById: Record<string, Task>;
  memberById: Record<string, Profile>;
  tz: string;
  today: string;
  toast: ToastMsg | null;
  showToast: (t: Omit<ToastMsg, 'id'>) => void;
  dismissToast: () => void;
  reload: () => Promise<void>;
  complete: (o: Occurrence) => Promise<void>;
  undo: (o: Occurrence) => Promise<void>;
  skip: (o: Occurrence) => Promise<void>;
  postpone: (o: Occurrence, date: string) => Promise<void>;
  saveTask: (draft: TaskDraft, existing?: { task: Task; occ?: Occurrence; dueDate: string }) => Promise<boolean>;
  archiveTask: (id: string, archived: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'display_name' | 'color' | 'emoji'>>) => Promise<void>;
  updateHousehold: (patch: Partial<Pick<Household, 'name' | 'timezone'>>) => Promise<void>;
};

const StoreCtx = createContext<Ctx | null>(null);
export const useData = (): Ctx => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useData außerhalb des Providers');
  return c;
};

const errMsg = (e: unknown) =>
  (e as { message?: string })?.message ?? 'Unbekannter Fehler';

export function DataProvider({ user, children }: { user: User; children: ReactNode }) {
  const cacheKey = `duo-cache-${user.id}`;
  const [data, setData] = useState<Data>(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as Data) : EMPTY;
    } catch { return EMPTY; }
  });
  const [status, setStatus] = useState<Ctx['status']>(data.household ? 'ready' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const toastTimer = useRef<number>();
  const tz = data.household?.timezone ?? 'Europe/Berlin';
  const [today, setToday] = useState(() => todayIn(tz));

  useEffect(() => {
    const tick = () => setToday(todayIn(tz));
    tick();
    const i = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(i); document.removeEventListener('visibilitychange', tick); };
  }, [tz]);

  const showToast = useCallback((t: Omit<ToastMsg, 'id'>) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...t, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), t.onAction ? 6000 : 3500);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    try {
      const { data: prof, error: pe } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (pe) throw pe;
      if (!prof) {
        setData(EMPTY); setStatus('ready'); setOnline(true); setError(null);
        return;
      }
      const hid = (prof as Profile).household_id;
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [h, m, t, o, e] = await Promise.all([
        supabase.from('households').select('*').eq('id', hid).single(),
        supabase.from('profiles').select('*').eq('household_id', hid).order('created_at'),
        supabase.from('tasks').select('*').eq('household_id', hid),
        supabase.from('task_occurrences').select('*').eq('household_id', hid)
          .or(`status.eq.open,completed_at.gte.${since}`),
        supabase.from('point_events').select('*').eq('household_id', hid)
          .order('created_at', { ascending: false }).limit(5000),
      ]);
      const firstErr = h.error || m.error || t.error || o.error || e.error;
      if (firstErr) throw firstErr;
      const next: Data = {
        household: h.data as Household,
        members: m.data as Profile[],
        tasks: t.data as Task[],
        occs: o.data as Occurrence[],
        events: e.data as PointEvent[],
      };
      setData(next);
      setStatus('ready'); setOnline(true); setError(null);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Speicher voll */ }
    } catch (err) {
      setOnline(false);
      setError(errMsg(err));
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [user.id, cacheKey]);

  useEffect(() => { void load(); }, [load]);

  // Realtime + Wiederherstellung beim Zurückkehren in die App
  const hid = data.household?.id;
  const debounce = useRef<number>();
  useEffect(() => {
    const schedule = () => {
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => void load(), 300);
    };
    const onVis = () => { if (document.visibilityState === 'visible') schedule(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', schedule);
    let ch: ReturnType<typeof supabase.channel> | null = null;
    if (hid) {
      ch = supabase.channel(`hh-${hid}`);
      for (const table of ['tasks', 'task_occurrences', 'point_events', 'profiles']) {
        ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, schedule);
      }
      ch.subscribe();
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', schedule);
      if (ch) void supabase.removeChannel(ch);
    };
  }, [hid, load]);

  const me = data.members.find((m) => m.id === user.id) ?? null;
  const partner = data.members.find((m) => m.id !== user.id) ?? null;
  const taskById = useMemo(() => Object.fromEntries(data.tasks.map((t) => [t.id, t])), [data.tasks]);
  const memberById = useMemo(() => Object.fromEntries(data.members.map((m) => [m.id, m])), [data.members]);

  const fail = useCallback((e: unknown) => showToast({ text: errMsg(e), kind: 'error' }), [showToast]);

  const undo = useCallback(async (o: Occurrence) => {
    const { error: e } = await supabase.rpc('undo_occurrence', { p_id: o.id });
    if (e) fail(e);
    await load();
  }, [fail, load]);

  const complete = useCallback(async (o: Occurrence) => {
    const task = taskById[o.task_id];
    // Optimistisch
    setData((d) => ({
      ...d,
      occs: d.occs.map((x) => (x.id === o.id
        ? { ...x, status: 'done' as const, completed_by: user.id, completed_at: new Date().toISOString() }
        : x)),
    }));
    const { error: e } = await supabase.rpc('complete_occurrence', { p_id: o.id });
    if (e) { fail(e); await load(); return; }
    showToast({
      text: `Erledigt${task ? ` · +${task.points} Punkte` : ''}`,
      actionLabel: 'Rückgängig',
      onAction: () => { void undo(o); dismissToast(); },
      kind: 'ok',
    });
    void supabase.functions.invoke('send-push', { body: { kind: 'completed', occurrence_id: o.id } }).catch(() => {});
    await load();
  }, [taskById, user.id, fail, load, showToast, undo, dismissToast]);

  const skip = useCallback(async (o: Occurrence) => {
    const { error: e } = await supabase.rpc('skip_occurrence', { p_id: o.id });
    if (e) fail(e); else showToast({ text: 'Übersprungen' });
    await load();
  }, [fail, load, showToast]);

  const postpone = useCallback(async (o: Occurrence, date: string) => {
    const { error: e } = await supabase.from('task_occurrences').update({ due_date: date }).eq('id', o.id);
    if (e) fail(e); else showToast({ text: 'Verschoben' });
    await load();
  }, [fail, load, showToast]);

  const saveTask = useCallback<Ctx['saveTask']>(async (draft, existing) => {
    if (!data.household || !me) return false;
    const row = { ...draft, assignee: draft.assignment === 'open' ? null : draft.assignee };
    if (existing) {
      const { error: e } = await supabase.from('tasks').update(row).eq('id', existing.task.id);
      if (e) { fail(e); return false; }
      if (existing.occ && existing.occ.due_date !== existing.dueDate) {
        const { error: e2 } = await supabase.from('task_occurrences')
          .update({ due_date: existing.dueDate }).eq('id', existing.occ.id);
        if (e2) { fail(e2); return false; }
      }
    } else {
      const { error: e } = await supabase.from('tasks')
        .insert({ ...row, household_id: data.household.id, created_by: me.id });
      if (e) { fail(e); return false; }
    }
    showToast({ text: 'Gespeichert', kind: 'ok' });
    await load();
    return true;
  }, [data.household, me, fail, load, showToast]);

  const archiveTask = useCallback(async (id: string, archived: boolean) => {
    const { error: e } = await supabase.from('tasks').update({ archived }).eq('id', id);
    if (e) fail(e); else showToast({ text: archived ? 'Archiviert' : 'Wiederhergestellt' });
    await load();
  }, [fail, load, showToast]);

  const deleteTask = useCallback(async (id: string) => {
    const { error: e } = await supabase.from('tasks').delete().eq('id', id);
    if (e) fail(e); else showToast({ text: 'Gelöscht' });
    await load();
  }, [fail, load, showToast]);

  const updateProfile = useCallback<Ctx['updateProfile']>(async (patch) => {
    const { error: e } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (e) fail(e);
    await load();
  }, [user.id, fail, load]);

  const updateHousehold = useCallback<Ctx['updateHousehold']>(async (patch) => {
    if (!data.household) return;
    const { error: e } = await supabase.from('households').update(patch).eq('id', data.household.id);
    if (e) fail(e);
    await load();
  }, [data.household, fail, load]);

  const value: Ctx = {
    ...data, user, status, error, online, me, partner, taskById, memberById, tz, today,
    toast, showToast, dismissToast, reload: load,
    complete, undo, skip, postpone, saveTask, archiveTask, deleteTask, updateProfile, updateHousehold,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
