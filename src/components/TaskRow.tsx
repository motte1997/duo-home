import type { Occurrence } from '../lib/types';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import { dueLabel, diffDays } from '../lib/dates';
import { Avatar, Icon, cv } from './ui';

export function TaskRow({ occ, hideDue }: { occ: Occurrence; hideDue?: boolean }) {
  const d = useData();
  const nav = useNav();
  const task = d.taskById[occ.task_id];
  if (!task) return null;
  const done = occ.status !== 'open';
  const assignee = occ.assigned_to ? d.memberById[occ.assigned_to] : null;
  const overdue = !done && occ.due_date !== null && diffDays(occ.due_date, d.today) < 0;
  const color = assignee?.color ?? 'var(--blue)';

  return (
    <div className={'row task' + (done ? ' is-done' : '')} onClick={() => nav.openTask(occ.id)}>
      <button
        className={'check' + (done ? ' on' : '')}
        style={cv(color)}
        aria-label={done ? 'Als offen markieren' : 'Erledigt'}
        onClick={(e) => {
          e.stopPropagation();
          void (done ? d.undo(occ) : d.complete(occ));
        }}
      >
        {done && <Icon.check />}
      </button>
      <div className="grow">
        <div className="title">{task.title}</div>
        <div className="sub">
          {assignee ? <><Avatar p={assignee} size={16} /> {assignee.display_name}</> : <span>👥 Offen</span>}
          {!hideDue && occ.due_date !== null && (
            <span className={overdue ? 'late' : ''}> · {dueLabel(occ.due_date, d.today)}</span>
          )}
          {task.recurrence !== 'none' && <span className="rep"> · <Icon.repeat /></span>}
        </div>
      </div>
      <span className="pill">+{task.points}</span>
    </div>
  );
}
