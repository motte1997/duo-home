export type Household = {
  id: string;
  name: string;
  timezone: string;
  invite_code: string;
};

export type Profile = {
  id: string;
  household_id: string;
  display_name: string;
  color: string;
  emoji: string;
};

export type Assignment = 'fixed' | 'open' | 'alternate';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'every_n_days' | 'monthly' | 'custom';
export type IntervalUnit = 'day' | 'week' | 'month';
export type RepeatMode = 'fixed' | 'after_completion';

export type Task = {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  points: number;
  assignment: Assignment;
  assignee: string | null;
  recurrence: Recurrence;
  interval_n: number;
  interval_unit: IntervalUnit;
  weekdays: number[];
  month_day: number | null;
  repeat_mode: RepeatMode;
  start_date: string;
  end_date: string | null;
  reminder_time: string; // "HH:MM:SS"
  archived: boolean;
  created_by: string | null;
};

export type Occurrence = {
  id: string;
  task_id: string;
  household_id: string;
  due_date: string; // YYYY-MM-DD
  assigned_to: string | null;
  status: 'open' | 'done' | 'skipped';
  completed_by: string | null;
  completed_at: string | null;
  points_awarded: number | null;
  spawned_occurrence_id: string | null;
};

export type PointEvent = {
  id: string;
  household_id: string;
  user_id: string;
  occurrence_id: string | null;
  task_id: string | null;
  title: string;
  points: number;
  local_date: string; // YYYY-MM-DD
  created_at: string;
};

export type TaskDraft = Omit<Task, 'id' | 'household_id' | 'created_by' | 'archived'>;
