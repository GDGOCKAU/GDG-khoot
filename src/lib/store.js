/* Quizzes, games and topics, saved in localStorage. One change signal for the whole app. */
import { useSyncExternalStore } from 'react';
import { TOPICS, TEAM_KEYS, uid, lsGet, lsSet } from './constants';
import { toast } from './ui';

let version = 0;
const subs = new Set();
export function notify() { version += 1; subs.forEach((f) => f()); }
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
/* re-render a component whenever data, the game or the theme changes */
export function useAppState() { return useSyncExternalStore(subscribe, () => version); }

const KEY = 'kauhoot.v2';
function q(text, answers, correct, time = 20, points = 1) { return { type: 'mc', text, answers, correct, time, points, img: null }; }
const DART_SUM = 'void main() {\n  int total = 0;\n  for (int i = 1; i <= 5; i++) {\n    total += i;\n  }\n  print(total);\n}';
function mixedQuiz() {
  return { id: uid(), title: 'Mixed Challenge', topic: 'Other', desc: 'All four question types: choice, true/false, code and pictures.', status: 'ready', pin: '271828', lastHosted: null, mixed: true, questions: [
    q('Which company created the Flutter framework?', ['Google', 'Meta', 'Microsoft', 'Apple'], 0),
    { type: 'tf', text: 'Flutter apps are written in the Dart language.', answers: ['True', 'False', '', ''], correct: 0, time: 15, points: 1, img: null },
    { type: 'code', text: 'What does this code print?', code: DART_SUM, lang: 'Dart', answers: ['10', '15', '5', 'Error'], correct: 1, time: 30, points: 1, img: null },
    { type: 'pic', text: 'Put the pictures together. What is the word?', pics: ['/img/door.svg', '/img/man.svg'], word: 'DOORMAN', answers: ['', '', '', ''], correct: -1, time: 30, points: 2, img: null },
    { type: 'tf', text: 'Gemini is a family of AI models made by Google.', answers: ['True', 'False', '', ''], correct: 0, time: 15, points: 1, img: null },
  ] };
}
function seed() {
  return {
    quizzes: [
      mixedQuiz(),
      { id: uid(), title: 'Flutter Basics', topic: 'Mobile', desc: 'Widgets, state and hot reload.', status: 'ready', pin: '482913', lastHosted: null, questions: [
        q('Which company created the Flutter framework?', ['Google', 'Meta', 'Microsoft', 'Apple'], 0),
        q('Which programming language do you write Flutter apps in?', ['Kotlin', 'Dart', 'Swift', 'JavaScript'], 1),
        q('In Flutter, almost everything you see on screen is a…', ['Fragment', 'Component', 'Widget', 'View'], 2, 15),
        q('Which widget can change its look while the app runs?', ['StatelessWidget', 'StatefulWidget', 'Container', 'Text'], 1),
        q('What does hot reload do?', ['Deletes the build folder', 'Shows code changes without restarting the app', 'Updates the Flutter SDK', 'Restarts your phone'], 1),
        q('Which widget lays out its children in a vertical line?', ['Row', 'Stack', 'Column', 'Wrap'], 2, 15, 2),
      ] },
      { id: uid(), title: 'Cloud 101', topic: 'Cloud', desc: 'Servers, storage and the basics of Google Cloud.', status: 'ready', pin: '615204', lastHosted: null, questions: [
        q('What does "IaaS" stand for?', ['Internet as a Service', 'Infrastructure as a Service', 'Integration as a Service', 'Identity as a Service'], 1),
        q('Which Google Cloud service stores files as objects in buckets?', ['Cloud Storage', 'BigQuery', 'Cloud Run', 'Pub/Sub'], 0),
        q('Which Google Cloud product is a serverless data warehouse?', ['Firestore', 'BigQuery', 'Compute Engine', 'Cloud DNS'], 1),
        q('Cloud Run runs your code inside…', ['Virtual tapes', 'Containers', 'Spreadsheets', 'Browser tabs'], 1),
        q('"Serverless" means…', ['There are no servers at all', 'You don\'t manage the servers yourself', 'It only runs offline', 'It runs only on phones'], 1),
      ] },
      { id: uid(), title: 'AI & Machine Learning', topic: 'AI', desc: 'Models, prompts and how they learn.', status: 'draft', pin: '730558', lastHosted: null, questions: [
        q('What does "ML" stand for?', ['Machine Learning', 'Multi Layer', 'Main Logic', 'Model Language'], 0),
        q('A model learning from labelled examples is called…', ['Unsupervised learning', 'Supervised learning', 'Reinforcement learning', 'Transfer learning'], 1),
        q('What is the text you give a language model called?', ['A prompt', 'A kernel', 'A tensor', 'A loss'], 0),
        q('Which Google model family powers the Gemini app?', ['Gemini', 'PaLM 1', 'BERT', 'AlphaGo'], -1),
      ] },
      { id: uid(), title: 'Web Dev Essentials', topic: 'Web', desc: 'HTML, CSS, JavaScript and the web platform.', status: 'ready', pin: '904417', lastHosted: null, questions: [
        q('What does HTML stand for?', ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlink Text Making Language'], 0),
        q('Which language styles a web page?', ['HTML', 'CSS', 'SQL', 'Python'], 1, 15),
        q('Which HTML tag makes a link?', ['<link>', '<a>', '<href>', '<url>'], 1, 15),
        q('Which CSS layout puts items in a row or column with gaps?', ['Float', 'Flexbox', 'Table', 'Marquee'], 1),
        q('What does the browser use to run JavaScript on a page?', ['A JavaScript engine', 'A database', 'A printer driver', 'A font file'], 0),
      ] },
    ],
    games: [],
    topics: [],
    mixedAdded: true,
  };
}

export let DB;
try { DB = JSON.parse(lsGet(KEY)) || seed(); } catch { DB = seed(); }
if (!DB || !Array.isArray(DB.quizzes)) DB = seed();
if (!Array.isArray(DB.topics)) DB.topics = [];
if (!Array.isArray(DB.games)) DB.games = [];
/* old or half-saved quizzes: keep them, but always with a list of question objects */
DB.quizzes = DB.quizzes.filter((z) => z && typeof z === 'object' && z.id)
  .map((z) => ({ ...z, title: typeof z.title === 'string' ? z.title : '', questions: Array.isArray(z.questions) ? z.questions.filter((x) => x && typeof x === 'object') : [] }));
if (!DB.mixedAdded) { DB.quizzes.unshift(mixedQuiz()); DB.mixedAdded = true; }
DB.quizzes.forEach((z) => z.questions.forEach((x) => { if (!x.type) x.type = 'mc'; }));
DB.topics.forEach((t) => { if (!TOPICS[t.name]) TOPICS[t.name] = { c: t.c, icon: 'star' }; });

export function save() {
  try { lsSet(KEY, JSON.stringify(DB)); } catch { toast('Storage is full. Try a smaller image.'); }
  notify();
}
save();

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
