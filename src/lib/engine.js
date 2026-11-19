/* GAME ENGINE — one engine for the host screen and the player screen.
   Single-device demo: practice players ("bots") join and answer by themselves. */
import { useSyncExternalStore } from 'react';
import { TEAM_KEYS, BOT_NAMES, mascot, pick, rnd, shuffle, uid, newPin } from './constants';
import { qType, norm, isCorrect, wrongGuess, qProblem } from './questions';
import { DB, quizById, save, notify } from './store';

/* the live game (or null) */
export let G = null;
/* screen state that has to survive moving between pages */
export const UI = { closed: null, showOver: false, overTab: null, look: null, homeFilter: 'All' };

/* 10× a second, for timers and answer counts */
let tickN = 0;
const tickSubs = new Set();
const subTick = (f) => { tickSubs.add(f); return () => tickSubs.delete(f); };
export function useTick() { return useSyncExternalStore(subTick, () => tickN); }

export const hosted = () => !!G && G.mode === 'host';
export const curQ = () => G.qs[G.qi];

function makeBot(name) {
  const team = pick(TEAM_KEYS);
  return { id: uid(), name, team, img: mascot(team, Math.floor(Math.random() * 12)), bot: true, skill: rnd(.4, .92), speed: rnd(.25, .8), score: 0, streak: 0, correct: 0, last: null, prevRank: 0 };
}
export function addMe(me) {
  G.me = { id: 'me', name: me.name, team: me.team, img: me.img, bot: false, score: 0, streak: 0, correct: 0, last: null, prevRank: 0 };
  G.players.push(G.me);
  UI.showOver = false;
}
export function newGame(quiz, mode, me) {
  stopGame(false);
  const qs = quiz.live
    ? quiz.questions.filter((x) => (x.text || '').trim() && (x.time > 0))
    : quiz.questions.filter((x) => !qProblem(x));
  G = { quiz, qs, mode, pin: mode === 'host' ? newPin() : (quiz.livePin || quiz.pin), backendSessionId: quiz.liveSessionId || null, players: [], qi: -1, phase: mode === 'host' ? 'lobby' : 'ready', phaseStart: Date.now(), phaseEnd: 0, answers: {}, locked: false, me: null, timer: null, joinTimer: null, recorded: false };
  UI.showOver = false; UI.closed = null;
  if (me) addMe(me);
  const names = shuffle(BOT_NAMES);
  const free = () => names.filter((n) => !G.players.some((p) => p.name.toLowerCase() === n.toLowerCase()));
  if (mode === 'player') { free().slice(0, 11).forEach((n) => G.players.push(makeBot(n))); setPhase('ready', 3000); }
  else {
    let k = 0;
    G.join = () => {
      if (!G || G.phase !== 'lobby' || G.locked || k >= 11) return;
      const n = free()[0]; if (!n) return;
      k += 1; G.players.push(makeBot(n));
      notify();
      G.joinTimer = setTimeout(G.join, rnd(700, 1600));
    };
    G.joinTimer = setTimeout(G.join, 900);
  }
  G.timer = setInterval(tick, 100);
  notify();
}
export function stopGame(signal = true) {
  if (!G) return;
  clearInterval(G.timer); clearTimeout(G.joinTimer);
  G = null;
  if (signal) notify();
}
function setPhase(phase, ms) {
  G.phase = phase; G.phaseStart = Date.now(); G.phaseEnd = ms ? Date.now() + ms : 0;
  notify();
}
function startQuestion(i) {
  G.qi = i; G.answers = {};
  const qq = curQ();
  G.players.forEach((p) => {
    if (!p.bot) return;
    const right = Math.random() < p.skill;
    const at = qq.time * 1000 * Math.min(.95, p.speed * rnd(qType(qq) === 'pic' ? .9 : .6, 1.3));
    if (qType(qq) === 'pic') { p.plan = { at, choice: right ? norm(qq.word) : wrongGuess(qq.word) }; return; }
    const wrongs = (qType(qq) === 'tf' ? [0, 1] : [0, 1, 2, 3]).filter((k) => k !== qq.correct && (qq.answers[k] || '').trim());
    p.plan = { at, choice: right || !wrongs.length ? qq.correct : pick(wrongs) };
  });
  setPhase('question', qq.time * 1000);
}
export function answer(pid, choice) {
  if (!G || G.phase !== 'question' || G.answers[pid]) return;
  G.answers[pid] = { choice, t: Date.now() - G.phaseStart };
  if (pid === 'me') notify();
  if (Object.keys(G.answers).length >= G.players.length) setTimeout(() => { if (G && G.phase === 'question') endQuestion(); }, 600);
}
function endQuestion() {
  const qq = curQ();
  const limit = qq.time * 1000;
  G.prevIdx = {}; G.prevTeams = {};
  ranked().forEach((p, i) => { p.prevRank = i + 1; G.prevIdx[p.id] = i; p.prevScore = p.score; });
  teamStats().forEach((t, i) => { G.prevTeams[t.key] = { idx: i, avg: t.avg }; });
  G.players.forEach((p) => {
    const a = G.answers[p.id];
    const ok = !!a && isCorrect(qq, a.choice);
    let pts = 0;
    if (ok) {
      p.streak += 1; p.correct += 1;
      if (qq.points > 0) pts = Math.round(1000 * (1 - Math.min(a.t, limit) / limit / 2)) * qq.points + Math.min(p.streak - 1, 5) * 100;
    } else p.streak = 0;
    p.score += pts;
    p.last = { choice: a ? a.choice : null, ok, pts };
  });
  setPhase('reveal', hosted() ? 5500 : 3500);
}
export function ranked() { return G.players.slice().sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)); }
export function rankOf(p) { return ranked().indexOf(p) + 1; }
export function teamStats() {
  return TEAM_KEYS.map((k) => {
    const ps = G.players.filter((p) => p.team === k);
    return { key: k, count: ps.length, avg: ps.length ? ps.reduce((s, p) => s + p.score, 0) / ps.length : 0 };
  }).filter((t) => t.count).sort((a, b) => b.avg - a.avg);
}
export function recordGame() {
  if (!G || G.recorded) return;
  G.recorded = true;
  const total = G.players.length * G.qs.length;
  const right = G.players.reduce((s, p) => s + p.correct, 0);
  DB.games.push({ quizId: G.quiz.id, at: Date.now(), players: G.players.length, accuracy: total ? right / total : 0, mode: G.mode });
  const qz = quizById(G.quiz.id); if (qz) qz.lastHosted = Date.now();
  save();
}
function tick() {
  if (!G) return;
  const now = Date.now();
  if (G.phase === 'question') {
    const el = now - G.phaseStart;
    G.players.forEach((p) => { if (p.bot && p.plan && !G.answers[p.id] && el >= p.plan.at) answer(p.id, p.plan.choice); });
  }
  if (G && G.phaseEnd && now >= G.phaseEnd) { advance(); return; }
  tickN += 1; tickSubs.forEach((f) => f());
}
function advance() {
  const last = G.qi >= G.qs.length - 1;
  switch (G.phase) {
    case 'ready': startQuestion(0); break;
    case 'question': endQuestion(); break;
    case 'reveal': if (hosted()) setPhase('leaderboard', 7000); else setPhase('answers', 4500); break;
    case 'answers': setPhase('leaderboard', 7000); break;
    case 'leaderboard': if (last) setPhase('teams', 8000); else setPhase('next', 3000); break;
    case 'next': startQuestion(G.qi + 1); break;
    case 'teams': setPhase('podium', 9000); break;
    case 'podium': recordGame(); setPhase('final', 0); break;
    default: break;
  }
}

/* host controls */
export function startHost(quiz) { newGame(quiz, 'host', null); }
export function toggleLock() { G.locked = !G.locked; clearTimeout(G.joinTimer); if (!G.locked) G.joinTimer = setTimeout(G.join, 700); notify(); }
export function startGame() { clearTimeout(G.joinTimer); setPhase('ready', 3000); }
export function skip() { G.phaseEnd = Date.now(); }
export function endGame() { recordGame(); if (G.me) { G.ended = true; clearInterval(G.timer); notify(); } else stopGame(); }
export function exitGame() {
  const hadMe = G && G.me ? { title: G.quiz.title, name: G.me.name } : null;
  stopGame(false); UI.closed = hadMe; notify();
  return hadMe;
}

/* timer values for the live widgets */
export function liveTime() {
  if (!G) return { secs: 0, frac: 0 };
  const left = G.phaseEnd ? Math.max(0, G.phaseEnd - Date.now()) : 0;
  const total = G.phaseEnd ? G.phaseEnd - G.phaseStart : 1;
  return { secs: Math.ceil(left / 1000), frac: 1 - left / total };
}

/* join from the "Choose your look" page. Returns an error message, or '' when in. */
export function joinGame(look, quiz) {
  const name = (look.name || '').trim();
  if (!name) return 'Pick a nickname first.';
  const me = { name, team: look.team, img: mascot(look.team, look.idx) };
  UI.overTab = null;
  if (quiz.live) {
    if (G && G.quiz?.id === quiz.id && G.me) {
      Object.assign(G.me, me);
      notify();
      return '';
    }
    newGame(quiz, 'player', me);
    return '';
  }
  if (look.live && hosted()) {
    if (G.phase === 'final') return 'This game has ended.';
    if (G.players.some((p) => p !== G.me && p.name.toLowerCase() === name.toLowerCase())) return 'That nickname is taken. Try another.';
    if (G.me) Object.assign(G.me, me); else addMe(me);
    notify();
    return '';
  }
  if (!quiz.questions.some((x) => !qProblem(x))) return 'This quiz has no complete questions yet.';
  newGame(quiz, 'player', me);
  return '';
}
