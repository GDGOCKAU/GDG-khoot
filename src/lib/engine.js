/* GAME ENGINE — one engine for the host screen and the player screen.
   Single-device demo: practice players ("bots") join and answer by themselves. */
import { useSyncExternalStore } from 'react';
import { TEAM_KEYS, BOT_NAMES, mascot, pick, rnd, shuffle, uid, newPin } from './constants';
import { qType, norm, isCorrect, wrongGuess, qProblem } from './questions';
import { DB, quizById, save, notify } from './store';
import { assetUrl } from '../api/client';

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
export function newGame(quiz, mode, me, opts = {}) {
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
  else if (opts.live) {
    /* live host: real players arrive from the server, never practice bots */
    G.liveHost = true;
    G.join = () => {};
  } else {
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
  if (G.socket) G.socket.disconnect();
  G = null;
  if (signal) notify();
}
function setPhase(phase, ms) {
  G.phase = phase; G.phaseStart = Date.now(); G.phaseEnd = ms ? Date.now() + ms : 0;
  notify();
}
/* live host: the server opens the question (POST /start or /next); the screen follows its closesAt */
let liveHostOpen = null;
export function onLiveHostOpen(f) { liveHostOpen = f; }
/* live host hooks set by live.js: reveal, finish, cancel */
const liveHooks = {};
export function setLiveHooks(h) { Object.assign(liveHooks, h); }
function startQuestion(i) {
  if (G.liveHost && liveHostOpen) {
    const g = G;
    G.phaseEnd = 0; // hold the countdown screen until the server answers
    liveHostOpen(i).then((q) => {
      if (G !== g) return;
      G.qi = i; G.answers = {}; G.liveAnswered = 0;
      G.phase = 'question';
      G.phaseEnd = Date.now() + Math.max(0, new Date(q.closesAt).getTime() - Date.now());
      G.phaseStart = G.phaseEnd - q.timeLimitSecs * 1000;
      notify();
    }).catch(() => { if (G === g) notify(); });
    return;
  }
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
  if (G.live) { if (pid === 'me') liveAnswer(choice); return; }
  G.answers[pid] = { choice, t: Date.now() - G.phaseStart };
  if (pid === 'me') notify();
  if (Object.keys(G.answers).length >= G.players.length) setTimeout(() => { if (G && G.phase === 'question') endQuestion(); }, 600);
}
function endQuestion() {
  if (G.liveHost && liveHooks.reveal) {
    if (G.revealing) return;
    const g = G;
    G.revealing = true; G.phaseEnd = 0;
    liveHooks.reveal().then((r) => {
      if (G !== g) return;
      G.revealing = false;
      applyStandings(r, r.choices);
      setPhase('reveal', 5500);
    }).catch(() => { if (G === g) { G.revealing = false; G.phaseEnd = Date.now() + 2000; notify(); } });
    return;
  }
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
  /* live player: the server moves the phases; locally we only redraw timers */
  if (G.live) {
    /* display only: reveal -> leaderboard -> next-countdown, then wait for the server */
    if (G.phaseEnd && now >= G.phaseEnd && (G.phase === 'reveal' || G.phase === 'leaderboard')) { advance(); return; }
    if (G.phaseEnd && now >= G.phaseEnd) G.phaseEnd = 0;
    tickN += 1; tickSubs.forEach((f) => f()); return;
  }
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
    case 'reveal': if (hosted() || G.live) setPhase('leaderboard', 7000); else setPhase('answers', 4500); break;
    case 'answers': setPhase('leaderboard', 7000); break;
    case 'leaderboard':
      if (G.live) { if (!last) setPhase('next', 3000); else G.phaseEnd = 0; break; }
      if (last) { if (G.liveHost && liveHooks.finish) liveHooks.finish(); setPhase('teams', 8000); } else setPhase('next', 3000);
      break;
    case 'next': startQuestion(G.qi + 1); break;
    case 'teams': setPhase('podium', 9000); break;
    case 'podium': recordGame(); setPhase('final', 0); break;
    default: break;
  }
}

/* host controls */
export function startHost(quiz, opts = {}) { newGame(quiz, 'host', null, opts); }
export function toggleLock() { G.locked = !G.locked; clearTimeout(G.joinTimer); if (!G.locked) G.joinTimer = setTimeout(G.join, 700); notify(); }
export function startGame() { clearTimeout(G.joinTimer); setPhase('ready', 3000); }
export function skip() { G.phaseEnd = Date.now(); }
export function endGame() { if (G && G.resumeKey) localStorage.removeItem(G.resumeKey); recordGame(); if (G.me) { G.ended = true; clearInterval(G.timer); notify(); } else stopGame(); }
export function exitGame() {
  if (G && G.liveHost && liveHooks.cancel && G.phase !== 'final') liveHooks.cancel();
  if (G && G.resumeKey) localStorage.removeItem(G.resumeKey);
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

/* ---------- LIVE PLAYER (server-driven) ----------
   The player gets no questions up front. It sits in 'lobby' until the server sends
   the first "question" event, which only happens after the host's /start. */
export function newLiveGame(quiz, me, { sessionId, participantId }) {
  stopGame(false);
  G = { quiz, qs: Array.from({ length: quiz.questionCount || 0 }, () => null), mode: 'player', live: true, pin: quiz.livePin, backendSessionId: sessionId, participantId, players: [], qi: -1, phase: 'lobby', phaseStart: Date.now(), phaseEnd: 0, answers: {}, locked: false, me: null, timer: null, joinTimer: null, recorded: false, socket: null };
  UI.showOver = false; UI.closed = null;
  addMe(me);
  G.timer = setInterval(tick, 100);
  notify();
}
/* a question as the server sends it: options carry ids, never correctness */
export function liveQuestion(q) {
  if (!G || !G.live || !q) return;
  while (G.qs.length < (q.questionCount || 0)) G.qs.push(null);
  G.qs[q.order] = {
    type: q.type || 'mc', text: q.text, questionId: q.questionId,
    answers: (q.options || []).map((o) => o.text), optionIds: (q.options || []).map((o) => o.id),
    correct: -1, time: q.timeLimitSecs, points: 1, img: null,
    code: q.code || '', lang: q.language || 'Dart', pics: (q.pictureUrls || []).map(assetUrl),
    /* only the letter count is known until Reveal */
    word: q.type === 'pic' ? 'X'.repeat(q.wordLength || 0) : '',
  };
  if (G.qi !== q.order) G.answers = {};
  G.qi = q.order;
  G.phase = 'question';
  /* the timer follows the server's closesAt */
  const left = Math.max(0, new Date(q.closesAt).getTime() - Date.now());
  G.phaseEnd = Date.now() + left;
  G.phaseStart = G.phaseEnd - q.timeLimitSecs * 1000;
  notify();
}
export function livePhase(phase) {
  if (!G || !G.live) return;
  G.phase = phase; G.phaseEnd = 0;
  notify();
}
let liveAnswerHandler = null;
export function onLiveAnswer(f) { liveAnswerHandler = f; }
function liveAnswer(choice) {
  const qq = curQ();
  if (!qq) return;
  G.answers.me = { choice, t: Date.now() - G.phaseStart };
  notify();
  if (liveAnswerHandler) liveAnswerHandler(qq, choice);
}

const mascotIdx = (m) => { const n = Number(String(m || '').split('-')[1]); return Number.isInteger(n) ? n : 0; };
/* standings from the server (reveal/final) become the players everyone's screens rank and animate.
   choices (host only): participantId -> option index, or true/false for picture questions */
export function applyStandings(r, choices) {
  if (!G || !r) return;
  const qq = curQ();
  G.prevIdx = {}; G.prevTeams = {};
  ranked().forEach((p, i) => { p.prevRank = i + 1; G.prevIdx[p.id] = i; p.prevScore = p.score; });
  teamStats().forEach((t, i) => { G.prevTeams[t.key] = { idx: i, avg: t.avg }; });
  if (qq && Number.isInteger(r.correctIndex) && r.correctIndex >= 0) qq.correct = r.correctIndex;
  if (qq && r.word) qq.word = r.word;
  if (choices && qq) {
    G.answers = {};
    Object.entries(choices).forEach(([pid, c]) => { G.answers[pid] = { choice: typeof c === 'boolean' ? (c ? qq.word : '') : c, t: 0 }; });
  }
  const byId = new Map(G.players.map((p) => [p.id, p]));
  const next = (r.standings || []).map((st) => {
    const id = G.live && st.id === G.participantId ? 'me' : st.id;
    const p = byId.get(id) || { id, bot: false, prevRank: 0, img: mascot(st.team, mascotIdx(st.mascot)) };
    const choice = id === 'me' ? (G.answers.me ? G.answers.me.choice : null) : (G.answers[st.id] ? G.answers[st.id].choice : null);
    Object.assign(p, { name: st.name, team: st.team, score: st.score, streak: st.streak, correct: st.correct,
      last: r.questionId ? { choice: st.answered ? choice : null, ok: st.lastOk, pts: st.lastPts } : p.last });
    return p;
  });
  if (G.me && !next.includes(G.me)) next.push(G.me);
  G.players = next;
}

/* host screen re-attached after a refresh: rebuild players and pick the phase up from the server */
export function applyHostState(st) {
  if (!G || !st) return;
  if (st.pin) G.pin = st.pin;
  applyStandings({ standings: st.standings || [] });
  if (st.status === 'ACTIVE' && st.question) {
    G.qi = st.question.order; G.answers = {}; G.liveAnswered = 0;
    G.phase = 'question';
    G.phaseEnd = Date.now() + Math.max(0, new Date(st.question.closesAt).getTime() - Date.now());
    G.phaseStart = G.phaseEnd - st.question.timeLimitSecs * 1000;
    notify();
  } else if (st.status === 'REVEAL') {
    G.qi = st.currentQuestionOrder ?? 0;
    setPhase('leaderboard', 4000);
  } else notify();
}
