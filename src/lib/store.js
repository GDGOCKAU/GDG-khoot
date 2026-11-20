/* Quizzes (from the server, in memory), games and topics. One change signal for the whole app. */
import { useSyncExternalStore } from 'react';
import { TOPICS, TEAM_KEYS, lsGet, lsSet } from './constants';

let version = 0;
const subs = new Set();
export function notify() { version += 1; subs.forEach((f) => f()); }
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
/* re-render a component whenever data, the game or the theme changes */
export function useAppState() { return useSyncExternalStore(subscribe, () => version); }

/* Quizzes come only from the server and are kept in memory; nothing about them is saved in the browser.
   Only custom topic names are remembered locally. */
const TOPICS_KEY = 'kauhoot.topics';

/* older versions kept demo and saved quizzes in localStorage ('kauhoot.v2', earlier 'kauhoot.v1'):
   drop them once, with the host-resume keys of those quizzes. Theme, sidebar, admin sign-in and a
   player's live seat are separate keys and stay. */
try {
  const old = Object.keys(localStorage).filter((k) => /^kauhoot\.v\d+$/.test(k));
  if (old.length) {
    old.forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage).filter((k) => k.startsWith('kauhoot:host:')).forEach((k) => localStorage.removeItem(k));
  }
} catch { /* storage blocked: nothing to clean */ }

function loadTopics() {
  try {
    const list = JSON.parse(lsGet(TOPICS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((t) => t && typeof t.name === 'string' && t.name.trim()) : [];
  } catch { return []; }
}

/* quizzes: the admin's quizzes from the server (loaded by lib/serverQuizzes); games: this tab's games */
export const DB = { quizzes: [], games: [], topics: loadTopics(), loaded: false };
DB.topics.forEach((t) => { if (!TOPICS[t.name]) TOPICS[t.name] = { c: t.c, icon: 'star' }; });

export function save() {
  try { lsSet(TOPICS_KEY, JSON.stringify(DB.topics)); } catch { /* storage blocked */ }
  notify();
}

export const quizById = (id) => DB.quizzes.find((x) => x.id === id);
export const ready = (qz) => qz.status === 'ready';
export function topicNames() { return Object.keys(TOPICS).filter((t) => t !== 'Other').concat('Other'); }
/* returns the topic name to use */
export function addTopic(name) {
  const found = Object.keys(TOPICS).find((t) => t.toLowerCase() === name.toLowerCase());
  if (found) return { name: found, added: false };
  const c = TEAM_KEYS[Object.keys(TOPICS).length % 4];
  DB.topics.push({ name, c });
  TOPICS[name] = { c, icon: 'star' };
  save();
  return { name, added: true };
}
export function upsertQuiz(d) {
  const i = DB.quizzes.findIndex((x) => x.id === d.id);
  const copy = JSON.parse(JSON.stringify(d));
  if (i >= 0) DB.quizzes[i] = copy; else DB.quizzes.unshift(copy);
  save();
}
export function deleteQuiz(id) { DB.quizzes = DB.quizzes.filter((x) => x.id !== id); save(); }

/* admin session */
let admin = false;
try { admin = sessionStorage.getItem('kauhoot.admin') === '1'; } catch { /* no session storage */ }
export const isAdmin = () => admin;
export function setAdmin(v) {
  admin = v;
  try { if (v) sessionStorage.setItem('kauhoot.admin', '1'); else sessionStorage.removeItem('kauhoot.admin'); } catch { /* */ }
  notify();
}
