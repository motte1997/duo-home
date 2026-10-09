import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import { addDays, cmpDue, weekStart } from '../lib/dates';
import { Avatar, Empty, Ring, Segmented } from '../components/ui';
import { TaskRow } from '../components/TaskRow';
import { totals } from '../lib/stats';

export function Today() {
  const d = useData();
  const nav = useNav();
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  const wkStart = weekStart(d.today);
  const wkEnd = addDays(wkStart, 6);

  const view = useMemo(() => {
    const open = d.occs
      .filter((o) => o.status === 'open')
      .filter((o) => scope === 'all' || o.assigned_to === d.user.id || o.assigned_to === null)
      .sort((a, b) => cmpDue(a.due_date, b.due_date));
    const done = d.occs
      .filter((o) => o.status === 'done' && o.completed_at && o.completed_at.length > 0)
      .filter((o) => scope === 'all' || o.completed_by === d.user.id)
      .filter((o) => d.events.some((e) => e.occurrence_id === o.id && e.local_date === d.today));
    return {
      overdue: open.filter((o) => o.due_date !== null && o.due_date < d.today),
      today: open.filter((o) => o.due_date === d.today),
      week: open.filter((o) => o.due_date !== null && o.due_date > d.today && o.due_date <= wkEnd),
      anytime: open.filter((o) => o.due_date === null),
      done,
    };
  }, [d.occs, d.events, d.today, d.user.id, scope, wkEnd]);

  const allOpen = d.occs.filter((o) => o.status === 'open');
  const dueToday = allOpen.filter((o) => o.due_date === d.today).length;
  const dueWeek = allOpen.filter((o) => o.due_date !== null && o.due_date >= d.today && o.due_date <= wkEnd).length;

  const weekEvents = d.events.filter((e) => e.local_date >= wkStart && e.local_date <= wkEnd);
  const openThisWeek = allOpen.filter((o) => o.due_date !== null && o.due_date <= wkEnd).length;
  const progress = weekEvents.length + openThisWeek === 0 ? 0 : weekEvents.length / (weekEvents.length + openThisWeek);

  const people = d.members.map((m) => ({
    m, total: totals(d.events, m.id).points,
    week: weekEvents.filter((e) => e.user_id === m.id).reduce((a, e) => a + e.points, 0),
  }));
  const leader = [...people].sort((a, b) => b.total - a.total)[0];
  const grand = Math.max(1, people.reduce((a, p) => a + p.total, 0));

  const empty = view.overdue.length + view.today.length + view.week.length + view.anytime.length === 0;

  return (
    <div className="page">
      <div className="titlebar">
        <h1 className="large">Heute</h1>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Alle' }, { value: 'mine', label: 'Meine' }]} />
      </div>

      {d.members.length < 2 && d.household && (
        <div className="card invite">
          <strong>Partner einladen</strong>
          <p>Teile diesen Code: <b className="code">{d.household.invite_code}</b></p>
        </div>
      )}

      <div className="card score" onClick={nav.openLeaderboard}>
        <div className="score-top">
          {people.map(({ m, total, week }) => (
            <div key={m.id} className="score-person">
              <Avatar p={m} size={40} />
              <div className="score-name">{m.id === d.user.id ? 'Du' : m.display_name}{leader?.m.id === m.id && total > 0 ? ' 👑' : ''}</div>
              <div className="score-pts" style={{ color: m.color }}>{total}</div>
              <div className="score-week">+{week} diese Woche</div>
            </div>
          ))}
        </div>
        <div className="vs-bar">
          {people.map(({ m, total }) => (
            <span key={m.id} style={{ width: `${(total / grand) * 100}%`, background: m.color }} />
          ))}
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><b>{allOpen.filter((o) => o.due_date !== null).length}</b><span>Offen</span></div>
        <div className="tile"><b>{dueToday}</b><span>Heute fällig</span></div>
        <div className="tile"><b>{dueWeek}</b><span>Diese Woche</span></div>
        <div className="tile ringtile">
          <Ring value={progress} size={54} stroke={7} color="var(--green)">
            <small>{Math.round(progress * 100)}%</small>
          </Ring>
          <span>Wochenfortschritt</span>
        </div>
      </div>

      {empty && view.done.length === 0 && (
        <Empty emoji="🎉" title="Alles erledigt!" text="Keine offenen Aufgaben. Tippe auf + für eine neue Aufgabe." />
      )}

      {view.overdue.length > 0 && (
        <>
          <div className="section-title late">Überfällig · {view.overdue.length}</div>
          <div className="group">{view.overdue.map((o) => <TaskRow key={o.id} occ={o} />)}</div>
        </>
      )}
      {view.today.length > 0 && (
        <>
          <div className="section-title">Heute · {view.today.length}</div>
          <div className="group">{view.today.map((o) => <TaskRow key={o.id} occ={o} hideDue />)}</div>
        </>
      )}
      {view.week.length > 0 && (
        <>
          <div className="section-title">Diese Woche · {view.week.length}</div>
          <div className="group">{view.week.map((o) => <TaskRow key={o.id} occ={o} />)}</div>
        </>
      )}
      {view.anytime.length > 0 && (
        <>
          <div className="section-title">Jederzeit · {view.anytime.length}</div>
          <div className="group">{view.anytime.map((o) => <TaskRow key={o.id} occ={o} />)}</div>
        </>
      )}
      {view.done.length > 0 && (
        <>
          <div className="section-title">Heute erledigt · {view.done.length}</div>
          <div className="group">{view.done.map((o) => <TaskRow key={o.id} occ={o} hideDue />)}</div>
        </>
      )}
      {d.status === 'error' && <p className="note err">Offline – Daten konnten nicht geladen werden.</p>}
      <div style={{ height: 24 }} />
    </div>
  );
}

