import type { Task } from './types';

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']; // ISO 1..7

type R = Pick<Task, 'recurrence' | 'interval_n' | 'interval_unit' | 'weekdays' | 'month_day'>;

function weekdayText(w: number[]): string {
  return [...w].sort().map((i) => WEEKDAYS[i - 1]).join(', ');
}

export function describeRecurrence(t: R): string {
  const n = t.interval_n;
  switch (t.recurrence) {
    case 'none':
      return 'Einmalig';
    case 'daily':
      return 'Täglich';
    case 'every_n_days':
      return `Alle ${n} Tage`;
    case 'weekly': {
      const base = n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`;
      return t.weekdays.length ? `${base} (${weekdayText(t.weekdays)})` : base;
    }
    case 'monthly': {
      const base = n === 1 ? 'Monatlich' : `Alle ${n} Monate`;
      return t.month_day ? `${base} am ${t.month_day}.` : base;
    }
    case 'custom': {
      const unit = t.interval_unit === 'day' ? (n === 1 ? 'Tag' : 'Tage')
        : t.interval_unit === 'week' ? (n === 1 ? 'Woche' : 'Wochen')
        : (n === 1 ? 'Monat' : 'Monate');
      const extra = t.interval_unit === 'week' && t.weekdays.length ? ` (${weekdayText(t.weekdays)})` : '';
      return `Alle ${n} ${unit}${extra}`;
    }
  }
}

export const RECURRENCE_OPTIONS: { value: Task['recurrence']; label: string }[] = [
  { value: 'none', label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'every_n_days', label: 'Alle X Tage' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'custom', label: 'Individuell' },
];
