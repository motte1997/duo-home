import type { PointEvent } from './types';
import { addDays, addMonths, diffDays, monthEnd, monthLabel, monthStart, rangeDays, weekStart, dayMonth } from './dates';

export type PeriodKind = 'week' | 'month';

export type Period = {
  start: string;
  end: string;
  days: string[];
  label: string;
  axis: string[]; // Beschriftung je Tag
};

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function periodRange(kind: PeriodKind, offset: number, today: string): Period {
  if (kind === 'week') {
    const start = addDays(weekStart(today), 7 * offset);
    const end = addDays(start, 6);
    const days = rangeDays(start, end);
    return { start, end, days, label: `${dayMonth(start)} – ${dayMonth(end)}`, axis: WD };
  }
  const base = addMonths(today, offset);
  const start = monthStart(base);
  const end = monthEnd(base);
  const days = rangeDays(start, end);
  return {
    start, end, days, label: monthLabel(base),
    axis: days.map((d, i) => ((i + 1) % 5 === 0 || i === 0 ? String(Number(d.slice(8))) : '')),
  };
}

export function inRange(e: PointEvent, p: { start: string; end: string }): boolean {
  return e.local_date >= p.start && e.local_date <= p.end;
}

/** Aufgaben je Tag und Person */
export function countsPerDay(events: PointEvent[], days: string[], userIds: string[]): number[][] {
  return userIds.map((uid) =>
    days.map((d) => events.filter((e) => e.user_id === uid && e.local_date === d).length)
  );
}

/** Kumulierte Punkte je Tag und Person (ab Periodenbeginn) */
export function cumulativePoints(events: PointEvent[], days: string[], userIds: string[]): number[][] {
  return userIds.map((uid) => {
    let sum = 0;
    return days.map((d) => {
      sum += events.filter((e) => e.user_id === uid && e.local_date === d).reduce((a, e) => a + e.points, 0);
      return sum;
    });
  });
}

export function totals(events: PointEvent[], userId: string): { points: number; count: number } {
  let points = 0, count = 0;
  for (const e of events) if (e.user_id === userId) { points += e.points; count++; }
  return { points, count };
}

export function whoDoesWhat(events: PointEvent[], userId: string, limit = 5) {
  const m = new Map<string, { title: string; count: number; points: number }>();
  for (const e of events) {
    if (e.user_id !== userId) continue;
    const k = e.title.trim().toLowerCase();
    const cur = m.get(k) ?? { title: e.title, count: 0, points: 0 };
    cur.count++; cur.points += e.points;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || b.points - a.points).slice(0, limit);
}

function runStats(dates: string[], today: string): { current: number; best: number } {
  const set = new Set(dates);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && diffDays(d, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // aktuelle Serie: heute oder gestern als Ende
  let cur = 0;
  let d = set.has(today) ? today : addDays(today, -1);
  while (set.has(d)) { cur++; d = addDays(d, -1); }
  return { current: cur, best };
}

export function streakFor(events: PointEvent[], userId: string, today: string) {
  return runStats(events.filter((e) => e.user_id === userId).map((e) => e.local_date), today);
}

/** Serie an Tagen, an denen beide mindestens eine Aufgabe erledigt haben */
export function bothStreak(events: PointEvent[], ids: string[], today: string) {
  if (ids.length < 2) return { current: 0, best: 0 };
  const per = ids.map((id) => new Set(events.filter((e) => e.user_id === id).map((e) => e.local_date)));
  const both = [...per[0]].filter((d) => per.every((s) => s.has(d)));
  return runStats(both, today);
}
