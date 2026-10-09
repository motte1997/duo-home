// Alle Datumswerte sind "YYYY-MM-DD"-Strings (Kalendertage in der Haushalts-Zeitzone).
const pad = (n: number) => String(n).padStart(2, '0');

export function todayIn(tz: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    return fmt(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
}
export function isoDow(s: string): number {
  const d = parse(s).getUTCDay();
  return d === 0 ? 7 : d;
}
export function weekStart(s: string): string {
  return addDays(s, 1 - isoDow(s));
}
export function monthStart(s: string): string {
  return s.slice(0, 8) + '01';
}
export function addMonths(s: string, n: number): string {
  const d = parse(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmt(d);
}
export function monthEnd(s: string): string {
  return addDays(addMonths(s, 1), -1);
}
export function rangeDays(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const MONTHS = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
const MONTHS_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function shortDate(s: string): string {
  const d = parse(s);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}
export function dayMonth(s: string): string {
  const d = parse(s);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]}`;
}
export function monthLabel(s: string): string {
  const d = parse(s);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function dueLabel(due: string, today: string): string {
  const n = diffDays(due, today);
  if (n === 0) return 'Heute';
  if (n === 1) return 'Morgen';
  if (n === -1) return 'Gestern';
  if (n < -1) return `vor ${-n} Tagen`;
  if (n < 7) return `${DAYS[parse(due).getUTCDay()]}, ${dayMonth(due)}`;
  return shortDate(due);
}

/** Sortierung nach Fälligkeit; Aufgaben ohne Fälligkeit kommen ans Ende. */
export function cmpDue(a: string | null, b: string | null): number {
  return (a ?? '9999-12-31').localeCompare(b ?? '9999-12-31');
}

export function timeHM(t: string): string {
  return t.slice(0, 5);
}
