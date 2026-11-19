/* Question types: multiple choice, true/false, code, picture word */
import { LETTERS, esc } from './constants';

export const qType = (x) => x.type || 'mc';
export const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const LANGS = ['Dart', 'Python', 'JavaScript', 'Kotlin', 'Java', 'C++', 'Go', 'SQL'];
export const QTYPES = [['mc', 'Multiple choice'], ['tf', 'True / False'], ['code', '</> Coding'], ['pic', 'Picture']];

export function isCorrect(qq, choice) {
  return qType(qq) === 'pic' ? !!norm(qq.word) && norm(choice) === norm(qq.word) : choice === qq.correct;
}
export function correctLabel(qq) {
  const t = qType(qq);
  return t === 'pic' ? String(qq.word).toUpperCase() : `${t === 'tf' ? '' : LETTERS[qq.correct] + ' · '}${qq.answers[qq.correct]}`;
}
export function wrongGuess(word) {
  const w = norm(word).split('');
  if (!w.length) return 'X';
  const i = Math.floor(Math.random() * w.length);
  let c;
  do { c = String.fromCharCode(65 + Math.floor(Math.random() * 26)); } while (c === w[i]);
  w[i] = c;
  return w.join('');
}
/* returns escaped HTML with syntax colour spans */
export function highlight(code) {
  const re = /("[^"\n]*"|'[^'\n]*')|(\b\d+(?:\.\d+)?\b)|(\b(?:void|var|final|const|for|while|if|else|return|int|double|String|bool|class|def|function|let|fun|val|in|of|import|from|func|package|new|true|false|null|None|True|False|SELECT|FROM|WHERE|public|static|private)\b)|(\b[A-Za-z_]\w*(?=\())/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const t = esc(m[0]);
    out += m[1] ? `<span class="hs">${t}</span>` : m[2] ? `<span class="hn">${t}</span>` : m[3] ? `<span class="hk">${t}</span>` : `<span class="hf">${t}</span>`;
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

export function blankQ() {
  return { type: 'mc', text: '', answers: ['', '', '', ''], correct: -1, time: 20, points: 1, img: null, code: '', lang: 'Dart', pics: [], word: '' };
}
export function qProblem(x) {
  const t = qType(x);
  if (!x.text.trim()) return 'needs a question';
  if (t === 'pic') return (x.pics || []).length < 2 ? 'needs 2 pictures' : !norm(x.word) ? 'needs the answer word' : '';
  if (t === 'tf') return x.correct !== 0 && x.correct !== 1 ? 'needs a correct answer' : '';
  if (t === 'code' && !(x.code || '').trim()) return 'needs code';
  return x.correct < 0 || !(x.answers[x.correct] || '').trim() ? 'needs a correct answer' : x.answers.filter((a) => a.trim()).length < 2 ? 'needs 2 answers' : '';
}
export function setQType(x, t) {
  const cur = qType(x);
  if (cur === t) return;
  if (t === 'tf') { x.mcAnswers = x.answers; x.answers = ['True', 'False', '', '']; if (x.correct > 1) x.correct = -1; }
  else if (cur === 'tf') { x.answers = x.mcAnswers || ['', '', '', '']; delete x.mcAnswers; if (x.correct >= 0 && !(x.answers[x.correct] || '').trim()) x.correct = -1; }
  if (t === 'code') { if (x.code == null) x.code = ''; if (!x.lang) x.lang = 'Dart'; if (x.time < 30) x.time = 30; }
  if (t === 'pic') { if (!x.pics) x.pics = []; if (x.word == null) x.word = ''; if (x.time < 30) x.time = 30; }
  x.type = t;
}
