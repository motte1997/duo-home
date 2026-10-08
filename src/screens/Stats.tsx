import { useMemo, useState } from 'react';
import { useData } from '../lib/store';
import { useNav } from '../lib/nav';
import {
  bothStreak, countsPerDay, cumulativePoints, inRange, periodRange, streakFor, totals, whoDoesWhat,
  type PeriodKind,
} from '../lib/stats';
import { Avatar, Empty, Icon, Segmented } from '../components/ui';
import { Donut, LineChart, StackedBars } from '../components/charts';

export function Stats() {
  const d = useData();
  const nav = useNav();
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0);

  const ids = d.members.map((m) => m.id);
  const colors = d.members.map((m) => m.color);
  const period = useMemo(() => periodRange(kind, offset, d.today), [kind, offset, d.today]);
  const evs = useMemo(() => d.events.filter((e) => inRange(e, period)), [d.events, period]);

  const bars = countsPerDay(evs, period.days, ids);
  const line = cumulativePoints(evs, period.days, ids);
  const counts = ids.map((id) => totals(evs, id));
  const sumCount = counts.reduce((a, c) => a + c.count, 0);
  const pct = (i: number) => (sumCount ? Math.round((counts[i].count / sumCount) * 100) : 0);

  return (
    <div className="page">
      <div className="titlebar">
        <h1 className="large">Statistik</h1>
        <button className="round-btn" aria-label="Rangliste" onClick={nav.openLeaderboard}><Icon.trophy /></button>
      </div>
      <Segmented value={kind} onChange={(k) => { setKind(k); setOffset(0); }}
        options={[{ value: 'week', label: 'Woche' }, { value: 'month', label: 'Monat' }]} />
      <div className="period">
        <button className="link" onClick={() => setOffset(offset - 1)} aria-label="zurück">‹</button>
        <span>{period.label}</span>
        <button className="link" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} aria-label="weiter">›</button>
      </div>

      <div className="legend">
        {d.members.map((m) => <span key={m.id}><i style={{ background: m.color }} />{m.id === d.user.id ? 'Du' : m.display_name}</span>)}
      </div>

      <div className="card">
        <h3>Erledigte Aufgaben</h3>
        {sumCount === 0 ? <Empty emoji="📊" title="Keine Daten in diesem Zeitraum" />
          : <StackedBars axis={period.axis} series={bars} colors={colors} />}
      </div>

      <div className="card">
        <h3>Punkteentwicklung</h3>
        <LineChart axis={period.axis} series={line} colors={colors} />
      </div>

      <div className="card">
        <h3>Aufgabenteilung</h3>
        <div className="share">
          <Donut values={counts.map((c) => c.count)} colors={colors}
            center={<div className="donut-c"><b>{sumCount}</b><small>Aufgaben</small></div>} />
          <div className="share-list">
            {d.members.map((m, i) => (
              <div key={m.id} className="share-row">
                <Avatar p={m} size={26} />
                <div className="grow"><b>{pct(i)} %</b><small>{counts[i].count} Aufgaben · {counts[i].points} P</small></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Wer macht was?</h3>
        {d.members.map((m) => {
          const list = whoDoesWhat(evs, m.id);
          return (
            <div key={m.id} className="who">
              <div className="who-head"><Avatar p={m} size={22} /> <b>{m.id === d.user.id ? 'Du' : m.display_name}</b></div>
              {list.length === 0 ? <p className="muted small">Nichts erledigt.</p>
                : list.map((t) => <div key={t.title} className="who-row"><span>{t.title}</span><span>{t.count}×</span></div>)}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Serien 🔥</h3>
        <div className="streaks">
          {d.members.map((m) => {
            const s = streakFor(d.events, m.id, d.today);
            return (
              <div key={m.id} className="streak" style={{ ['--c' as string]: m.color } as React.CSSProperties}>
                <Avatar p={m} size={28} />
                <b><Icon.flame /> {s.current}</b>
                <small>Tage in Folge</small>
                <small>Beste: {s.best}</small>
              </div>
            );
          })}
          {d.members.length === 2 && (() => {
            const s = bothStreak(d.events, ids, d.today);
            return (
              <div className="streak both">
                <span className="both-ico">🤝</span>
                <b><Icon.flame /> {s.current}</b>
                <small>Beide aktiv</small>
                <small>Beste: {s.best}</small>
              </div>
            );
          })()}
        </div>
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
