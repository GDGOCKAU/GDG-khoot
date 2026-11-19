import { lsGet, lsSet } from './constants';
import { notify } from './store';

if (lsGet('kauhoot.theme') === 'dark') document.documentElement.classList.add('dark');

export const isDark = () => document.documentElement.classList.contains('dark');
export function toggleTheme() {
  const d = document.documentElement.classList.toggle('dark');
  lsSet('kauhoot.theme', d ? 'dark' : 'light');
  notify();
}
