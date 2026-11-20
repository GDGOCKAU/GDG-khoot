/* CSV import / export for quizzes.
   Import reads our template, Kahoot's spreadsheet layout and most hand-made sheets:
   one question per row, columns found by their header names. */
import { blankQ, norm, qProblem, LANGS } from './questions';

/* the server's save rules (backend/src/validation.ts): a file that breaks them is reported row by row */
export const LIMITS = { file: 1024 * 1024, questions: 100, title: 60, desc: 90, topic: 20, text: 160, answer: 80, word: 20, code: 10000, url: 500 };
const TIMES = [5, 10, 15, 20, 30, 60];
const nearestTime = (t) => TIMES.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));

/* ---------- CSV text <-> rows ---------- */
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || '';
  let best = ',', bestN = 0;
  for (const d of [',', ';', '\t']) {
    let n = 0, inQ = false;
    for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === d && !inQ) n++; }
    if (n > bestN) { best = d; bestN = n; }
  }
  return best;
}

export function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const d = detectDelimiter(text);
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/* ---------- headers ---------- */
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
function columnFor(header) {
  const raw = String(header || '').toLowerCase().trim(), k = key(header);
  const m = raw.match(/^(?:answer|option|choice|الإجابة|خيار)\s*[-_#]?\s*([1-4a-d])\b/);
  if (m) return 'ans' + ('abcd'.includes(m[1]) ? 'abcd'.indexOf(m[1]) : +m[1] - 1);
  if (/^[a-d]$/.test(k)) return 'ans' + 'abcd'.indexOf(k);
  if (k.startsWith('correct') || k === 'answer' || k === 'key' || k === 'rightanswer' || k === 'الإجابةالصحيحة') return 'correct';
  if (k.startsWith('question') || k === 'q' || k === 'السؤال') return k.includes('type') ? 'type' : 'text';
  if (k === 'type' || k === 'kind' || k === 'النوع') return 'type';
  if (k.startsWith('time') || k === 'seconds' || k === 'secs' || k === 'الوقت') return 'time';
  if (k.startsWith('point') || k === 'double' || k === 'score') return 'points';
  if (k === 'code' || k === 'snippet') return 'code';
  if (k === 'language' || k === 'lang') return 'lang';
  if (k === 'word' || k === 'answerword') return 'word';
  if (k.startsWith('image') || k.startsWith('picture') || k === 'img' || k === 'pics') return 'image';
  return null;
}

/* ---------- one row -> one question ---------- */
const TYPE_WORDS = { mc: ['mc', 'multiplechoice', 'choice', 'quiz', 'multiple'], tf: ['tf', 'truefalse', 'trueorfalse', 'boolean', 'tof'], code: ['code', 'coding'], pic: ['pic', 'picture', 'pictures', 'image', 'puzzle'] };
const isTrue = (s) => ['true', 't', 'yes', 'صح', 'صحيح'].includes(String(s).toLowerCase().trim());
const isFalse = (s) => ['false', 'f', 'no', 'خطأ', 'خطا'].includes(String(s).toLowerCase().trim());

function rowToQuestion(cells, cols) {
  const get = (name) => { const i = cols.indexOf(name); return i < 0 ? '' : (cells[i] || '').trim(); };
  const notes = [];
  const q = blankQ();
  q.text = get('text');
  const answers = [0, 1, 2, 3].map((i) => get('ans' + i));
  const correctRaw = get('correct'), typeRaw = key(get('type'));
  let type = Object.keys(TYPE_WORDS).find((t) => TYPE_WORDS[t].includes(typeRaw)) || '';
  const filled = answers.filter(Boolean);
  if (!type) {
    if (get('code')) type = 'code';
    else if (get('word') && !filled.length) type = 'pic';
    else if ((filled.length === 2 && isTrue(filled[0]) && isFalse(filled[1])) || (!filled.length && (isTrue(correctRaw) || isFalse(correctRaw)))) type = 'tf';
    else type = 'mc';
  }
  q.type = type;

  /* time and points */
  const t = parseInt(get('time'), 10);
  q.time = Number.isFinite(t) ? nearestTime(t) : (type === 'code' || type === 'pic' ? 30 : type === 'tf' ? 15 : 20);
  if (Number.isFinite(t) && t !== q.time) notes.push(`time ${t} s changed to ${q.time} s (allowed: ${TIMES.join(', ')})`);
  const p = get('points').toLowerCase().replace(/\s+/g, '');
  q.points = p === '2' || p === 'x2' || p === 'double' || p === 'yes' ? 2 : p === '0' || p === 'none' || p === 'nopoints' ? 0 : 1;

  if (type === 'pic') {
    q.word = get('word') || correctRaw;
    q.answers = ['', '', '', ''];
    q.correct = -1;
    q.pics = get('image').split('|').map((s) => s.trim()).filter((s) => /^(https?:|data:|\/)/.test(s));
    if (q.pics.length < 2) notes.push('add the pictures in the editor');
    return { q, notes };
  }

  if (type === 'tf') {
    q.answers = ['True', 'False', '', ''];
    const c = correctRaw.toLowerCase();
    q.correct = isTrue(c) || c === 'a' || c === '1' ? 0 : isFalse(c) || c === 'b' || c === '2' ? 1 : -1;
  } else {
    q.answers = answers;
    /* correct: a letter, a number, "Answer 2", or the answer text itself; Kahoot allows "1,3" */
    const parts = correctRaw.split(/[,;|/]| and /i).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) notes.push(`more than one correct answer given, kept "${parts[0]}"`);
    const c = parts[0] || '';
    let idx = -1;
    const lm = c.match(/^(?:answer|option|choice)?\s*([a-d1-4])$/i);
    if (lm) { const ch = lm[1].toLowerCase(); idx = 'abcd'.includes(ch) ? 'abcd'.indexOf(ch) : +ch - 1; }
    if (idx < 0 && c) idx = answers.findIndex((a) => a && a.toLowerCase() === c.toLowerCase());
    q.correct = idx;
    if (c && idx < 0) notes.push(`correct answer "${c}" doesn't match any answer`);
  }
  if (type === 'code') {
    /* a hand-typed "\n" means a new line, unless the cell already has real line breaks (then it is code text) */
    const code = get('code');
    q.code = /\n/.test(code) ? code : code.replace(/\\n/g, '\n');
    const lang = get('lang');
    q.lang = LANGS.find((l) => l.toLowerCase() === lang.toLowerCase()) || (lang ? lang : 'Dart');
  }
  const img = get('image');
  if (/^(https?:|data:image)/.test(img)) q.img = img;
  return { q, notes };
}

/* what the server would refuse; '' when the question fits */
export function limitProblem(q) {
  if (q.text.length > LIMITS.text) return `question is ${q.text.length} characters (max ${LIMITS.text})`;
  if (q.type !== 'pic' && q.type !== 'tf') {
    const k = q.answers.findIndex((a) => a.length > LIMITS.answer);
    if (k >= 0) return `answer ${'ABCD'[k]} is ${q.answers[k].length} characters (max ${LIMITS.answer})`;
  }
  if (q.type === 'pic' && norm(q.word).length > LIMITS.word) return `word is ${norm(q.word).length} letters (max ${LIMITS.word})`;
  if (q.type === 'code' && q.code.length > LIMITS.code) return `code is longer than ${LIMITS.code} characters`;
  const urls = [q.img, ...(q.pics || [])].filter(Boolean);
  if (urls.some((u) => !u.startsWith('data:') && u.length > LIMITS.url)) return `an image link is longer than ${LIMITS.url} characters`;
  return '';
}

/* ---------- whole file ---------- */
const META = { title: 'title', quiz: 'title', quiztitle: 'title', name: 'title', العنوان: 'title', topic: 'topic', category: 'topic', الموضوع: 'topic', description: 'desc', desc: 'desc', الوصف: 'desc' };

export function importQuizCSV(text, fileName = '') {
  const rows = parseCSV(text);
  const meta = { title: '', topic: '', desc: '' };
  let headerAt = -1, cols = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const mk = META[key(r[0])];
    if (mk && r.filter(Boolean).length <= 2 && !rows[i].some((c) => columnFor(c) === 'text')) { meta[mk] = r[1] || ''; continue; }
    const mapped = r.map(columnFor);
    if (mapped.includes('text') && (mapped.some((c) => c && c.startsWith('ans')) || mapped.includes('correct') || mapped.includes('type'))) { headerAt = i; cols = mapped; break; }
  }
  if (headerAt < 0) {
    /* no header row: assume Question, A, B, C, D, Correct */
    cols = ['text', 'ans0', 'ans1', 'ans2', 'ans3', 'correct', 'time'];
  }
  const items = [];
  rows.slice(headerAt + 1).forEach((r, k) => {
    const rowNo = headerAt + 2 + k;
    const { q, notes } = rowToQuestion(r, cols);
    if (!q.text && !q.answers.some(Boolean)) return;
    const problem = qProblem(q);
    items.push({ row: rowNo, q, notes, problem: problem === 'needs 2 pictures' ? '' : problem, limit: limitProblem(q) });
  });
  if (!meta.title && fileName) meta.title = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return { meta, items, headerFound: headerAt >= 0 };
}

/* ---------- export ---------- */
const HEAD = ['Question', 'Type', 'Answer A', 'Answer B', 'Answer C', 'Answer D', 'Correct', 'Time', 'Points', 'Code', 'Language', 'Word', 'Image'];
export function quizToCSV(quiz) {
  const rows = [['Title', quiz.title || ''], ['Topic', quiz.topic || ''], ['Description', quiz.desc || ''], [], HEAD];
  quiz.questions.forEach((x) => {
    const t = x.type || 'mc';
    const correct = t === 'pic' ? '' : t === 'tf' ? (x.correct === 0 ? 'True' : x.correct === 1 ? 'False' : '') : x.correct >= 0 ? 'ABCD'[x.correct] : '';
    const images = t === 'pic' ? (x.pics || []).filter((s) => !s.startsWith('data:')).join(' | ') : x.img && !x.img.startsWith('data:') ? x.img : '';
    rows.push([x.text, t, ...(t === 'tf' || t === 'pic' ? ['', '', '', ''] : x.answers.slice(0, 4)), correct, x.time, x.points === 2 ? 2 : x.points === 0 ? 0 : 1, t === 'code' ? x.code : '', t === 'code' ? x.lang : '', t === 'pic' ? x.word : '', images]);
  });
  return toCSV(rows);
}

export function downloadText(name, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const csvName = (title) => (String(title || 'quiz').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '') || 'quiz') + '.csv';

export const TEMPLATE_QUIZ = {
  title: 'My GDG Quiz', topic: 'Mobile', desc: 'One line about the quiz',
  questions: [
    { type: 'mc', text: 'Which company created Flutter?', answers: ['Google', 'Meta', 'Microsoft', 'Apple'], correct: 0, time: 20, points: 1 },
    { type: 'tf', text: 'Flutter apps are written in Dart.', answers: ['True', 'False', '', ''], correct: 0, time: 15, points: 1 },
    { type: 'code', text: 'What does this code print?', code: 'void main() {\n  print(2 + 3);\n}', lang: 'Dart', answers: ['23', '5', 'Error', '2 + 3'], correct: 1, time: 30, points: 2 },
    { type: 'mc', text: 'Which widget stacks children vertically?', answers: ['Row', 'Column', 'Stack', ''], correct: 1, time: 20, points: 1 },
  ],
};
