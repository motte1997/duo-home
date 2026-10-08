import { useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import type { Assignment, IntervalUnit, Recurrence, RepeatMode, TaskDraft } from '../lib/types';
import { RECURRENCE_OPTIONS, WEEKDAYS } from '../lib/recurrence';
import { Segmented, Sheet, Stepper } from '../components/ui';

type Who = 'me' | 'partner' | 'open' | 'alternate';

export function TaskForm({ taskId }: { taskId?: string }) {
  const d = useData();
  const nav = useNav();
  const task = taskId ? d.taskById[taskId] : undefined;
  const occ = task
    ? d.occs.filter((o) => o.task_id === task.id && o.status === 'open').sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
    : undefined;
  const partnerId = d.partner?.id ?? null;

  const initialWho: Who = !task ? 'open'
    : task.assignment === 'open' ? 'open'
    : task.assignment === 'alternate' ? 'alternate'
    : task.assignee === d.user.id ? 'me' : 'partner';

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [points, setPoints] = useState(task?.points ?? 3);
  const [who, setWho] = useState<Who>(initialWho);
  const [altStart, setAltStart] = useState<'me' | 'partner'>(
    task?.assignment === 'alternate' && task.assignee === partnerId ? 'partner' : 'me');
  const [due, setDue] = useState(occ?.due_date ?? task?.start_date ?? d.today);
  const [rec, setRec] = useState<Recurrence>(task?.recurrence ?? 'none');
  const [n, setN] = useState(task?.interval_n ?? 1);
  const [unit, setUnit] = useState<IntervalUnit>(task?.interval_unit ?? 'week');
  const [wds, setWds] = useState<number[]>(task?.weekdays ?? []);
  const [mday, setMday] = useState<number | null>(task?.month_day ?? null);
  const [mode, setMode] = useState<RepeatMode>(task?.repeat_mode ?? 'fixed');
  const [end, setEnd] = useState(task?.end_date ?? '');
  const [rem, setRem] = useState((task?.reminder_time ?? '08:00').slice(0, 5));
  const [saving, setSaving] = useState(false);

  const showN = rec === 'every_n_days' || rec === 'weekly' || rec === 'monthly' || rec === 'custom';
  const nLabel = rec === 'every_n_days' ? 'Alle … Tage' : rec === 'weekly' ? 'Alle … Wochen'
    : rec === 'monthly' ? 'Alle … Monate' : 'Alle …';
  const showWeekdays = rec === 'weekly' || (rec === 'custom' && unit === 'week');
  const showMonthDay = rec === 'monthly' || (rec === 'custom' && unit === 'month');
  const disableWho = !partnerId;

  const toggleWd = (i: number) => setWds((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i].sort()));

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const assignment: Assignment = who === 'open' ? 'open' : who === 'alternate' ? 'alternate' : 'fixed';
    const assignee = who === 'open' ? null
      : who === 'me' ? d.user.id
      : who === 'partner' ? partnerId
      : altStart === 'me' ? d.user.id : (partnerId ?? d.user.id);
    const draft: TaskDraft = {
      title: title.trim(), notes: notes.trim() || null, points, assignment, assignee,
      recurrence: rec, interval_n: showN ? Math.max(1, n) : 1,
      interval_unit: rec === 'custom' ? unit : 'day',
      weekdays: showWeekdays ? wds : [], month_day: showMonthDay ? mday : null,
      repeat_mode: rec === 'none' ? 'fixed' : mode,
      start_date: task ? task.start_date : due, end_date: end || null,
      reminder_time: rem || '08:00',
    };
    const ok = await d.saveTask(draft, task ? { task, occ, dueDate: due } : undefined);
    setSaving(false);
    if (ok) nav.closeForm();
  };

  const remove = async () => {
    if (!task) return;
    if (!window.confirm(`„${task.title}“ wirklich löschen? Die Punktehistorie bleibt erhalten.`)) return;
    await d.deleteTask(task.id);
    nav.closeForm(); nav.closePage();
  };

  const me = d.me, pt = d.partner;
  return (
    <Sheet title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} onClose={nav.closeForm} onSave={save} saving={saving}
      saveLabel={task ? 'Sichern' : 'Hinzufügen'}>
      <div className="group">
        <label className="row"><input className="big" autoFocus={!task} value={title} placeholder="Titel (z. B. Bad putzen)"
          onChange={(e) => setTitle(e.target.value)} maxLength={80} /></label>
        <label className="row"><input value={notes} placeholder="Notiz (optional)" onChange={(e) => setNotes(e.target.value)} maxLength={300} /></label>
      </div>

      <div className="group">
        <div className="row"><span className="grow">Punkte</span><Stepper value={points} onChange={setPoints} min={0} max={100} /></div>
        <div className="row">
          <div className="chips tight">
            {[1, 3, 5, 10, 20].map((p) => (
              <button key={p} className={'chip' + (p === points ? ' on' : '')} onClick={() => setPoints(p)}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">Zuweisung</div>
      <Segmented<Who> value={who} onChange={(v) => !disableWho || v === 'me' || v === 'open' ? setWho(v) : undefined}
        options={[
          { value: 'me', label: me?.display_name.slice(0, 8) || 'Ich' },
          { value: 'partner', label: pt?.display_name.slice(0, 8) || 'Partner' },
          { value: 'open', label: 'Offen' }, { value: 'alternate', label: 'Wechsel' },
        ]} />
      {who === 'alternate' && (
        <div className="group" style={{ marginTop: 10 }}>
          <div className="row"><span className="grow">Startet bei</span>
            <Segmented<'me' | 'partner'> value={altStart} onChange={setAltStart}
              options={[{ value: 'me', label: me?.display_name.slice(0, 8) || 'Ich' }, { value: 'partner', label: pt?.display_name.slice(0, 8) || 'Partner' }]} /></div>
        </div>
      )}
      {disableWho && <p className="hint">Sobald dein Partner beigetreten ist, kannst du Aufgaben auch ihm zuweisen.</p>}

      <div className="section-title">Termin</div>
      <div className="group">
        <label className="row"><span className="grow">{task ? 'Nächste Fälligkeit' : 'Fällig am'}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} required /></label>
        <label className="row"><span className="grow">Erinnerung um</span>
          <input type="time" value={rem} onChange={(e) => setRem(e.target.value)} /></label>
        <label className="row"><span className="grow">Wiederholung</span>
          <select value={rec} onChange={(e) => setRec(e.target.value as Recurrence)}>
            {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></label>
        {rec === 'custom' && (
          <label className="row"><span className="grow">Einheit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as IntervalUnit)}>
              <option value="day">Tage</option><option value="week">Wochen</option><option value="month">Monate</option>
            </select></label>
        )}
        {showN && <div className="row"><span className="grow">{nLabel}</span><Stepper value={n} onChange={setN} min={1} max={365} /></div>}
        {showMonthDay && (
          <label className="row"><span className="grow">Tag im Monat</span>
            <select value={mday ?? ''} onChange={(e) => setMday(e.target.value ? Number(e.target.value) : null)}>
              <option value="">wie Fälligkeit</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((x) => <option key={x} value={x}>{x}.</option>)}
            </select></label>
        )}
        {showWeekdays && (
          <div className="row"><div className="chips tight">
            {WEEKDAYS.map((w, i) => (
              <button key={w} className={'chip' + (wds.includes(i + 1) ? ' on' : '')} onClick={() => toggleWd(i + 1)}>{w}</button>
            ))}
          </div></div>
        )}
        {rec !== 'none' && (
          <>
            <div className="row"><span className="grow">Nächster Termin</span>
              <Segmented<RepeatMode> value={mode} onChange={setMode}
                options={[{ value: 'fixed', label: 'Fester Takt' }, { value: 'after_completion', label: 'Ab Erledigung' }]} /></div>
            <label className="row"><span className="grow">Enddatum</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </>
        )}
      </div>
      {rec !== 'none' && (
        <p className="hint">
          {mode === 'fixed'
            ? 'Fester Takt: Der nächste Termin richtet sich nach dem Kalender – egal, wann du erledigst.'
            : 'Ab Erledigung: Der Abstand zählt ab dem Tag, an dem die Aufgabe erledigt wurde.'}
        </p>
      )}

      {task && (
        <div className="group" style={{ marginTop: 24 }}>
          <button className="row danger-row" onClick={() => void d.archiveTask(task.id, !task.archived).then(nav.closeForm)}>
            {task.archived ? 'Wiederherstellen' : 'Archivieren'}
          </button>
          <button className="row danger-row red" onClick={remove}>Aufgabe löschen</button>
        </div>
      )}
      <div style={{ height: 30 }} />
    </Sheet>
  );
}
