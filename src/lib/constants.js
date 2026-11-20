/* Shared constants and small helpers */

/* the link people share: this site's own address (your real domain once it's online) */
export const SHARE_URL = typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin + '/' : 'https://gdgkau.com';
export const ADMIN_PASSWORD = 'gdgkau';
export const LETTERS = ['A', 'B', 'C', 'D'];
export const ANS_COLORS = ['blue', 'red', 'yellow', 'green'];
export const TEAMS = {
  blue:   { name: 'Blue',   solid: '#1a73e8', bright: '#4285f4', soft: 'var(--blue-soft)',   txt: 'var(--blue-txt)',   softHex: '#e8f0fe', txtHex: '#1a73e8' },
  red:    { name: 'Red',    solid: '#d93025', bright: '#ea4335', soft: 'var(--red-soft)',    txt: 'var(--red-txt)',    softHex: '#fce8e6', txtHex: '#c5221f' },
  yellow: { name: 'Yellow', solid: '#f9ab00', bright: '#fbbc04', soft: 'var(--yellow-soft)', txt: 'var(--yellow-txt)', softHex: '#fef7e0', txtHex: '#8a5a00' },
  green:  { name: 'Green',  solid: '#188038', bright: '#34a853', soft: 'var(--green-soft)',  txt: 'var(--green-txt)',  softHex: '#e6f4ea', txtHex: '#137333' },
};
export const TEAM_KEYS = ['blue', 'red', 'yellow', 'green'];
export const TOPICS = {
  Mobile: { c: 'blue',   icon: 'phone' },
  Cloud:  { c: 'red',    icon: 'cloud' },
  AI:     { c: 'yellow', icon: 'spark' },
  Web:    { c: 'green',  icon: 'code' },
  Other:  { c: 'blue',   icon: 'star' },
};
/* Your Devu mascots live in public/mascots */
export const mascot = (team, i) => `/mascots/${team}_${String(i + 1).padStart(2, '0')}.png`;
export const SPIDER = '/img/spider_mascot.png';
export const BOT_NAMES = ['Sara', 'CodeQueen', 'Lama_dev', 'Noura', 'FlutterFan', 'Reem', 'byte.me', 'Joud', 'Al_Aseel', 'Hala', '404NotFound', 'Dana', 'NullPointer', 'DartVader', 'GitHappens', 'CloudNine'];
export const NICK_A = ['Pixel', 'Byte', 'Cloud', 'Dart', 'Swift', 'Kotlin', 'Flutter', 'Debug', 'Neural', 'Turbo'];
export const NICK_B = ['Queen', 'Ninja', 'Fox', 'Star', 'Wizard', 'Hero', 'Owl', 'Rocket', 'Panda', 'Spark'];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const uid = () => Math.random().toString(36).slice(2, 10);
export const newPin = () => String(100000 + Math.floor(Math.random() * 900000));
export const pinFmt = (p) => p.slice(0, 3) + ' ' + p.slice(3);
export const ansCls = (i) => `c-${ANS_COLORS[i]}${i === 2 ? ' yel' : ''}`;
export const topicColor = (t) => (TOPICS[t] || TOPICS.Other).c;

/* Turns 'a:b;--c:d' into a React style object, so inline styles read like the prototype */
const cssCache = new Map();
export function css(str) {
  if (!str) return undefined;
  let o = cssCache.get(str);
  if (o) return o;
  o = {};
  str.split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (!k) return;
    o[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  });
  cssCache.set(str, o);
  return o;
}

/* storage that survives private mode */
const mem = {};
export function lsGet(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } }
