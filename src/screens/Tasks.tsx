import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import { addDays, dueLabel, weekStart } from '../lib/dates';
import { describeRecurrence } from '../lib/recurrence';
import { Avatar, Empty, Icon, Segmented } from '../components/ui';
import { TaskRow } from '../components/TaskRow';

type Seg = 'open' | 'recurring' | 'done' | 'archive';

export function Tasks() {
  const d = useData();
  const nav = useNav();
  const [seg, setSeg] = useState<Seg>('open');
  const [q, setQ] = useState('');

  const match = (title: string) => title.toLowerCase().includes(q.trim().toLowerCase());

  const open = useMemo(() => {
    const wkEnd = addDays(weekStart(d.today), 6);
    const list = d.occs.filter((o) => o.status === 'open' && match(d.taskById[o.task_id]?.title ?? ''))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    return [
      { label: 'Überfällig', late: true, items: list.filter((o) => o.due_date < d.today) },
      { label: 'Heute', items: list.filter((o) => o.due_date === d.today) },
      { label: 'Diese Woche', items: list.filter((o) => o.due_date > d.today && o.due_date <= wkEnd) },
      { label: 'Später', items: list.filter((o) => o.due_date > wkEnd) },
    ].filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.occs, d.taskById, d.today, q]);

  const recurring = d.tasks
    .filter((t) => t.recurrence !== 'none' && !t.archived && match(t.title))
    .sort((a, b) => a.title.localeCompare(b.title));
  const archived = d.tasks.filter((t) => t.archived && match(t.title));
  const done = d.occs
    .filter((o) => o.status !== 'open' && match(d.taskById[o.task_id]?.title ?? ''))
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));

  const nextOcc = (taskId: string) =>
    d.occs.filter((o) => o.task_id === taskId && o.status === 'open').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return (
    <div className="page">
      <div className="titlebar">
        <h1 className="large">Aufgaben</h1>
        <button className="round-btn" aria-label="Neue Aufgabe" onClick={() => nav.openForm()}><Icon.plus /></button>
      </div>
      <input className="search" type="search" placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} />
      <Segmented value={seg} onChange={setSeg} options={[
        { value: 'open', label: 'Offen' }, { value: 'recurring', label: 'Serien' },
        { value: 'done', label: 'Erledigt' }, { value: 'archive', label: 'Archiv' },
      ]} />

      {seg === 'open' && (open.length === 0
        ? <Empty emoji="✨" title="Keine offenen Aufgaben" text="Mit + legst du eine neue Aufgabe an." />
        : open.map((g) => (
          <div key={g.label}>
            <div className={'section-title' + (g.late ? ' late' : '')}>{g.label} · {g.items.length}</div>
            <div className="group">{g.items.map((o) => <TaskRow key={o.id} occ={o} />)}</div>
          </div>
        )))}

      {seg === 'recurring' && (recurring.length === 0
        ? <Empty emoji="🔁" title="Keine wiederkehrenden Aufgaben" />
        : <div className="group" style={{ marginTop: 16 }}>
          {recurring.map((t) => {
            const occ = nextOcc(t.id);
            const who = occ?.assigned_to ? d.memberById[occ.assigned_to] : null;
            return (
              <div key={t.id} className="row" onClick={() => nav.openForm(t.id)}>
                <Avatar p={who} size={30} />
                <div className="grow">
                  <div className="title">{t.title}</div>
                  <div className="sub">{describeRecurrence(t)}{occ ? ` · nächste: ${dueLabel(occ.due_date, d.today)}` : ''}</div>
                </div>
                <span className="pill">+{t.points}</span>
                <span className="chev"><Icon.chevron /></span>
              </div>
            );
          })}
        </div>)}

      {seg === 'done' && (done.length === 0
        ? <Empty emoji="📭" title="Noch nichts erledigt" text="Hier siehst du die letzten 30 Tage." />
        : <div className="group" style={{ marginTop: 16 }}>{done.map((o) => <TaskRow key={o.id} occ={o} hideDue />)}</div>)}

      {seg === 'archive' && (archived.length === 0
        ? <Empty emoji="🗄️" title="Archiv ist leer" />
        : <div className="group" style={{ marginTop: 16 }}>
          {archived.map((t) => (
            <div key={t.id} className="row" onClick={() => nav.openForm(t.id)}>
              <div className="grow"><div className="title">{t.title}</div><div className="sub">{describeRecurrence(t)}</div></div>
              <button className="link" onClick={(e) => { e.stopPropagation(); void d.archiveTask(t.id, false); }}>Wiederherstellen</button>
            </div>
          ))}
        </div>)}
      <div style={{ height: 24 }} />
    </div>
  );
}

