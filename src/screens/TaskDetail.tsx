import { useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import { addDays, dueLabel, shortDate } from '../lib/dates';
import { describeRecurrence } from '../lib/recurrence';
import { Avatar, Icon, PageHeader, cv } from '../components/ui';

export function TaskDetail({ occId }: { occId: string }) {
  const d = useData();
  const nav = useNav();
  const [date, setDate] = useState('');
  const occ = d.occs.find((o) => o.id === occId);
  const task = occ ? d.taskById[occ.task_id] : undefined;

  if (!occ || !task) {
    return (
      <div className="page">
        <PageHeader title="Aufgabe" onBack={nav.closePage} />
        <p className="muted pad">Diese Aufgabe existiert nicht mehr.</p>
      </div>
    );
  }
  const done = occ.status === 'done';
  const skipped = occ.status === 'skipped';
  const assignee = occ.assigned_to ? d.memberById[occ.assigned_to] : null;
  const doneBy = occ.completed_by ? d.memberById[occ.completed_by] : null;
  const color = assignee?.color ?? 'var(--blue)';

  return (
    <div className="page">
      <PageHeader title="Aufgabe" onBack={nav.closePage}
        right={<button className="link" onClick={() => nav.openForm(task.id)}>Bearbeiten</button>} />
      <div className="detail-head">
        <button className={'check big' + (done ? ' on' : '')} style={cv(color)} aria-label="Erledigt"
          onClick={() => void (done ? d.undo(occ) : skipped ? undefined : d.complete(occ))}>
          {done && <Icon.check size={26} />}
        </button>
        <h1>{task.title}</h1>
        {task.notes && <p className="muted">{task.notes}</p>}
        <span className="pill big">+{task.points} Punkte</span>
      </div>

      <div className="group">
        <div className="row"><span className="grow">Zuständig</span>
          {assignee ? <><Avatar p={assignee} size={22} />&nbsp;{assignee.display_name}</> : <span className="muted">Offen – wer zuerst</span>}</div>
        <div className="row"><span className="grow">Fällig</span>
          <span className={!done && occ.due_date < d.today ? 'late' : ''}>{dueLabel(occ.due_date, d.today)} · {shortDate(occ.due_date)}</span></div>
        <div className="row"><span className="grow">Wiederholung</span><span>{describeRecurrence(task)}</span></div>
        {task.recurrence !== 'none' && (
          <div className="row"><span className="grow">Modus</span>
            <span>{task.repeat_mode === 'fixed' ? 'Fester Takt' : 'Ab Erledigung'}</span></div>
        )}
        {task.assignment === 'alternate' && <div className="row"><span className="grow">Zuweisung</span><span>Abwechselnd</span></div>}
        {(done || skipped) && (
          <div className="row"><span className="grow">{done ? 'Erledigt von' : 'Übersprungen von'}</span>
            {doneBy && <><Avatar p={doneBy} size={22} />&nbsp;{doneBy.display_name}</>}</div>
        )}
      </div>

      {!done && !skipped && (
        <>
          <button className="btn primary block" onClick={() => { void d.complete(occ); nav.closePage(); }}>
            Erledigt (+{task.points})
          </button>
          <div className="section-title">Verschieben</div>
          <div className="chips">
            {[['Morgen', 1], ['In 3 Tagen', 3], ['Nächste Woche', 7]].map(([l, n]) => (
              <button key={l as string} className="chip"
                onClick={() => void d.postpone(occ, addDays(occ.due_date < d.today ? d.today : occ.due_date, n as number))}>{l}</button>
            ))}
          </div>
          <div className="group" style={{ marginTop: 10 }}>
            <label className="row"><span className="grow">Eigenes Datum</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="link bold" disabled={!date} onClick={() => void d.postpone(occ, date)}>OK</button></label>
          </div>
          {task.recurrence !== 'none' && (
            <div className="group" style={{ marginTop: 16 }}>
              <button className="row danger-row" onClick={() => { void d.skip(occ); nav.closePage(); }}>
                Diesmal überspringen
              </button>
            </div>
          )}
        </>
      )}
      {done && <p className="hint center">Punkte wurden gutgeschrieben. Mit dem Haken oben kannst du es rückgängig machen.</p>}
      <div style={{ height: 30 }} />
    </div>
  );
}
