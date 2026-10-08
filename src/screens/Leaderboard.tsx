import { useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import { diffDays, monthStart, shortDate, weekStart } from '../lib/dates';
import { Avatar, Empty, PageHeader, Segmented } from '../components/ui';

type Range = 'week' | 'month' | 'all';

export function Leaderboard() {
  const d = useData();
  const nav = useNav();
  const [range, setRange] = useState<Range>('week');

  const start = range === 'week' ? weekStart(d.today) : range === 'month' ? monthStart(d.today) : '0000-01-01';
  const evs = d.events.filter((e) => e.local_date >= start);
  const rank = d.members
    .map((m) => ({ m, pts: evs.filter((e) => e.user_id === m.id).reduce((a, e) => a + e.points, 0),
      cnt: evs.filter((e) => e.user_id === m.id).length }))
    .sort((a, b) => b.pts - a.pts);
  const gap = rank.length === 2 ? rank[0].pts - rank[1].pts : 0;

  // Historie nach Tagen gruppieren
  const hist = [...d.events].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 150);
  const groups: { day: string; items: typeof hist }[] = [];
  for (const e of hist) {
    const g = groups[groups.length - 1];
    if (g && g.day === e.local_date) g.items.push(e); else groups.push({ day: e.local_date, items: [e] });
  }
  const dayName = (day: string) => {
    const n = diffDays(day, d.today);
    return n === 0 ? 'Heute' : n === -1 ? 'Gestern' : shortDate(day);
  };

  return (
    <div className="page">
      <PageHeader title="Rangliste" onBack={nav.closePage} />
      <Segmented value={range} onChange={setRange}
        options={[{ value: 'week', label: 'Woche' }, { value: 'month', label: 'Monat' }, { value: 'all', label: 'Gesamt' }]} />

      <div className="podium">
        {rank.map((r, i) => (
          <div key={r.m.id} className={'podium-item p' + (i + 1)}>
            <div className="medal">{i === 0 && r.pts > 0 ? '🥇' : i === 0 ? '' : '🥈'}</div>
            <Avatar p={r.m} size={i === 0 ? 64 : 52} />
            <b>{r.m.id === d.user.id ? 'Du' : r.m.display_name}</b>
            <span className="big-pts" style={{ color: r.m.color }}>{r.pts}</span>
            <small>{r.cnt} Aufgaben</small>
          </div>
        ))}
      </div>
      {rank.length === 2 && (
        <p className="hint center">
          {gap === 0 ? 'Gleichstand – ein Duell auf Augenhöhe!' : `${rank[0].m.id === d.user.id ? 'Du führst' : rank[0].m.display_name + ' führt'} mit ${gap} Punkten.`}
        </p>
      )}

      <div className="section-title">Punkteverlauf</div>
      {groups.length === 0 ? <Empty emoji="🏁" title="Noch keine Punkte" text="Erledige eine Aufgabe, um zu starten." /> : (
        groups.map((g) => (
          <div key={g.day}>
            <div className="section-title sub">{dayName(g.day)}</div>
            <div className="group">
              {g.items.map((e) => {
                const m = d.memberById[e.user_id];
                return (
                  <div key={e.id} className="row">
                    <Avatar p={m} size={28} />
                    <div className="grow"><div className="title">{e.title}</div>
                      <div className="sub">{m?.display_name} · {new Date(e.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div></div>
                    <span className="pill">+{e.points}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      <div style={{ height: 30 }} />
    </div>
  );
}

