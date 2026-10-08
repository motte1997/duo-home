import { createContext, useContext } from 'react';

export type Tab = 'today' | 'tasks' | 'stats' | 'settings';
export type Page = { type: 'task'; id: string } | { type: 'leaderboard' } | null;
export type FormState = { taskId?: string } | null;

export type Nav = {
  tab: Tab;
  setTab: (t: Tab) => void;
  page: Page;
  openTask: (occId: string) => void;
  openLeaderboard: () => void;
  closePage: () => void;
  openForm: (taskId?: string) => void;
  closeForm: () => void;
};

export const NavCtx = createContext<Nav | null>(null);
export const useNav = (): Nav => {
  const n = useContext(NavCtx);
  if (!n) throw new Error('useNav außerhalb des Providers');
  return n;
};
