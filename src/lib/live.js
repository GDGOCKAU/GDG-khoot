/* LIVE SESSION WIRING — the only place that talks to the game server over Socket.IO.
   The server owns every phase and its end time; these handlers only copy what it sends into
   the engine so the existing screens can draw it.
   Player: game:join (validated, returns the current state). Host: host:join with the admin JWT. */
import { apiRequest, getStoredToken } from '../api/client';
import { connectSocket } from '../api/socket';
import { mascot } from './constants';
import { G, UI, applyStandings, exitGame, live, liveFinal, livePhaseEvent, liveQuestion, liveResult, liveReveal, newGame, newLiveGame, stopGame } from './engine';
import { notify } from './store';
import { toast } from './ui';

const mascotIdx = (m) => { const n = Number(String(m || '').split('-')[1]); return Number.isInteger(n) ? n : 0; };
const forgetPlayer = () => { localStorage.removeItem('gdgParticipantId'); localStorage.removeItem('gdgSessionId'); };

/* this browser's id, sent when joining: a device the host kicked cannot join that session again */
export function deviceId() {
  try {
    let id = localStorage.getItem('kauhoot.device');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 64); localStorage.setItem('kauhoot.device', id); }
    return id;
  } catch { return undefined; }
}
/* sessions this device was kicked from (kept short) */
const KICKED = 'kauhoot.kicked';
export function isKicked(sessionId) {
  try { return !!sessionId && JSON.parse(localStorage.getItem(KICKED) || '[]').includes(sessionId); } catch { return false; }
}
function markKicked(sessionId) {
  try { const list = JSON.parse(localStorage.getItem(KICKED) || '[]').filter((id) => id !== sessionId); localStorage.setItem(KICKED, JSON.stringify([...list, sessionId].slice(-20))); } catch { /* storage blocked */ }
}
/* the host removed this player: leave the game and show the "removed" page */
function kickedOut(sessionId) {
  markKicked(sessionId);
  forgetPlayer();
  if (G && G.socket) G.socket.disconnect();
  stopGame(false);
  UI.kicked = true;
  notify();
}

/* everything a screen needs to pick up where the server is (first join, reconnect, refresh) */
function applyState(state) {
  if (!G || !state) return;
  if (state.quizTitle) G.quiz.title = state.quizTitle;
  if (state.topic) G.quiz.topic = state.topic;
  if (state.pin) G.pin = state.pin;
  if (state.question) liveQuestion(state.question);
  if (state.reveal) liveReveal(state.reveal, state.hostReveal || null);
  if (state.result) liveResult(state.result);
  if (state.final) liveFinal(state.final);
  if (state.powerUps) G.power = state.powerUps;
  if (state.powerUps && state.powerUps.removedOptionIds) G.removed = state.powerUps.removedOptionIds;
  livePhaseEvent(state.phase);
}

/* ---------- player ---------- */

export function connectLivePlayer(sessionId, participantId) {
  const socket = connectSocket();
  G.socket = socket;
  /* runs on first connect and on every reconnect */
  socket.on('connect', () => {
    socket.emit('game:join', sessionId, participantId, (res) => {
      if (!G) return;
      if (res && res.error === 'kicked') { kickedOut(sessionId); return; }
      if (!res || !res.ok || (G.resuming && ['FINISHED', 'CANCELLED'].includes(res.state.status))) {
        if (G.resuming) { forgetPlayer(); stopGame(); return; }
        toast('You are no longer in this game.'); exitGame(); return;
      }
      if (res.state.participant && G.me) {
        const p = res.state.participant;
        Object.assign(G.me, { name: p.name, team: p.team, img: mascot(p.team, mascotIdx(p.mascot)), score: p.score, streak: p.streak });
      }
      G.resuming = false;
      if (res.state.answered && !G.answers.me) G.answers.me = { choice: null, t: 0 };
      applyState(res.state);
    });
  });
  socket.on('phase', livePhaseEvent);
  socket.on('question', (q) => { liveQuestion(q); if (G) G.power = { ...(G.power || {}), enabled: q.powerUps, doubleActive: false }; });
  socket.on('reveal', (r) => liveReveal(r, null));
  socket.on('result', liveResult);
  socket.on('final', liveFinal);
  socket.on('closed', () => { if (G && G.live) { forgetPlayer(); exitGame(); } });
  socket.on('kicked', () => kickedOut(sessionId));
  live.answer = (qq, choice) => {
    const pic = qq.type === 'pic';
    const optionId = !pic && qq.optionIds ? qq.optionIds[choice] : undefined;
    if (!pic && !optionId) return;
    apiRequest(`/api/v1/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(pic ? { participantId, questionId: qq.questionId, text: String(choice) } : { participantId, questionId: qq.questionId, optionId }),
    }).catch((error) => {
      if (error.status !== 409) toast(error.body?.error === 'answer_closed' ? "Time's up, your answer didn't count." : 'Your answer could not be sent.');
    });
  };
  return socket;
}

/* power-ups: the server checks the rules and picks the 50/50 options */
export async function activatePowerUp(kind) {
  if (!G || !G.live) return;
  try {
    const res = await apiRequest(`/api/v1/sessions/${G.backendSessionId}/powerups`, { method: 'POST', body: JSON.stringify({ participantId: G.participantId, kind }) });
    if (!G) return;
    G.power = { ...(G.power || {}), enabled: true, [kind === 'double' ? 'doubleUsed' : 'fiftyUsed']: true, ...(kind === 'double' ? { doubleActive: true } : {}) };
    if (kind === 'fifty') G.removed = res.removedOptionIds || [];
    notify();
    toast(kind === 'double' ? 'Double points on! Answer right to score x2.' : 'Two wrong answers removed.');
  } catch (error) {
    const code = error.body?.error;
    toast(code === 'power_up_used' ? 'You already used that one.' : code === 'power_up_not_allowed' ? 'Not on this question.' : 'Could not use that now.');
  }
}

/* a refreshed phone on /lobby or /play picks its seat back up */
export function resumeLivePlayer() {
  if (G) return false;
  const sessionId = localStorage.getItem('gdgSessionId'), participantId = localStorage.getItem('gdgParticipantId');
  if (!sessionId || !participantId) return false;
  newLiveGame({ id: 'live', title: '', topic: 'Other', questionCount: 0, questions: [], live: true }, { name: '', team: 'blue', img: mascot('blue', 0) }, { sessionId, participantId });
  G.resuming = true;
  connectLivePlayer(sessionId, participantId);
  return true;
}

/* a live player who leaves the game page frees their seat on the server */
export function leaveLive() {
  if (G && G.live) forgetPlayer();
  if (!G || !G.live || !G.participantId || ['teams', 'podium', 'final'].includes(G.phase)) return;
  apiRequest(`/api/v1/sessions/${G.backendSessionId}/leave`, { method: 'POST', body: JSON.stringify({ participantId: G.participantId }), keepalive: true }).catch(() => {});
}

/* ---------- host ---------- */

export function connectLiveHost(sessionId, onFirstState) {
  const socket = connectSocket();
  G.socket = socket;
  let first = true;
  socket.on('connect', () => {
    socket.emit('host:join', sessionId, getStoredToken(), (res) => {
      if (first && onFirstState) { first = false; onFirstState(res); return; }
      first = false;
      if (!res || !res.ok) { toast('The server rejected the host connection. Log in again.'); return; }
      applyHostState(res.state);
    });
  });
  socket.on('player_joined', ({ participant }) => {
    if (!G || G.players.some((player) => player.id === participant.id)) return;
    G.players.push({
      id: participant.id, name: participant.name, team: participant.team,
      img: mascot(participant.team, mascotIdx(participant.mascot)),
      bot: false, score: 0, streak: 0, correct: 0, last: null, prevRank: 0,
    });
    notify();
  });
  socket.on('player_left', ({ participantId }) => {
    if (!G) return;
    G.players = G.players.filter((player) => player.id !== participantId);
    notify();
  });
  socket.on('phase', livePhaseEvent);
  socket.on('question', liveQuestion);
  socket.on('answer_count', ({ count }) => { if (G && G.phase === 'question') { G.liveAnswered = Math.max(G.liveAnswered || 0, count); notify(); } });
  socket.on('reveal_host', (r) => liveReveal(r, r));
  socket.on('final', liveFinal);
  const post = (path, body = {}) => apiRequest(`/api/v1/sessions/${sessionId}/${path}`, { method: 'POST', body: JSON.stringify(body) });
  live.start = () => post('start').catch((error) => toast(error.body?.error === 'no_players' ? 'Wait for at least one player.' : 'The server did not start the game.'));
  live.skip = () => post('skip').catch(() => {});
  live.cancel = () => post('cancel').catch(() => {});
  /* resolves true when the server removed the player */
  live.kick = (participantId) => post('kick', { participantId })
    .then(() => { if (G) { G.players = G.players.filter((p) => p.id !== participantId); notify(); } return true; })
    .catch(() => { toast('Could not remove that player.'); return false; });
  live.lock = (locked) => setSettings({ locked });
  return socket;
}

/* host lobby settings: lock the room, power-ups on/off */
export function setSettings(body) {
  if (!G || !G.backendSessionId) return Promise.resolve();
  return apiRequest(`/api/v1/sessions/${G.backendSessionId}/settings`, { method: 'PATCH', body: JSON.stringify(body) })
    .then((res) => { if (G) { G.locked = res.locked; G.powerUps = res.powerUps; notify(); } })
    .catch(() => toast('Could not change that setting.'));
}

function applyHostState(state) {
  if (!G || !state) return;
  applyStandings(state.standings || []);
  G.liveAnswered = state.answeredCount || 0;
  applyState(state);
}

/* a refreshed host screen re-attaches to its running session instead of opening a new one */
const hostKey = (quizId) => `kauhoot:host:${quizId}`;
export function rememberHostSession(quizId, sessionId) { localStorage.setItem(hostKey(quizId), sessionId); G.resumeKey = hostKey(quizId); }
export function resumeLiveHost(quizId) {
  const sessionId = localStorage.getItem(hostKey(quizId));
  if (!sessionId) return Promise.resolve(false);
  const g = G;
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (done) return; done = true; if (G === g && G.socket) { G.socket.disconnect(); G.socket = null; } resolve(false); }, 5000);
    connectLiveHost(sessionId, (res) => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (G !== g) { resolve(true); return; }
      if (!res || !res.ok || !['LOBBY', 'ACTIVE', 'REVEAL'].includes(res.state.status)) {
        localStorage.removeItem(hostKey(quizId));
        if (G.socket) G.socket.disconnect();
        G.socket = null;
        resolve(false);
        return;
      }
      G.backendSessionId = sessionId;
      G.resumeKey = hostKey(quizId);
      applyHostState(res.state);
      resolve(true);
    });
  });
}

/* ---------- audience screen (/screen): read-only, no login ---------- */
/* It joins the public "screen" room and follows the newest open session. The engine's host
   screens draw it, so it looks like the host view without any controls. */
let screenSocket = null;

/* the server sends only counts to the screen (never who picked what), so rebuild anonymous answers for the charts */
function screenAnswers(r) {
  if (!G || !r) return;
  const qq = G.qs[r.index];
  if (!qq) return;
  G.answers = {};
  if (Array.isArray(r.counts)) {
    r.counts.forEach((n, i) => { for (let k = 0; k < n; k += 1) G.answers[`a${i}:${k}`] = { choice: i, t: 0 }; });
  } else if (r.counts) {
    for (let k = 0; k < r.counts.right; k += 1) G.answers[`r${k}`] = { choice: qq.word, t: 0 };
    for (let k = 0; k < r.counts.wrong; k += 1) G.answers[`w${k}`] = { choice: '~', t: 0 };
  }
}

/* null state = no open quiz: show the waiting screen */
function loadScreen(state) {
  if (!state) { if (G) stopGame(); return; }
  newGame({ id: state.quizId, title: state.quizTitle, topic: state.topic || 'Other', live: true, questions: [] }, 'host', null, { live: true });
  G.mode = 'screen'; // not a host: no "host screen" pill, no practice bots
  G.pin = state.pin;
  G.backendSessionId = state.sessionId;
  G.qs = Array.from({ length: state.questionCount || 0 }, () => null);
  applyStandings(state.standings || []);
  G.liveAnswered = state.answeredCount || 0;
  applyState(state);
  screenAnswers(state.reveal);
  notify();
}

export function connectScreen() {
  if (screenSocket) return;
  const socket = connectSocket();
  screenSocket = socket;
  const watch = () => socket.emit('screen:watch', (res) => { if (res && res.ok) loadScreen(res.state); });
  socket.on('connect', watch);
  socket.on('screen:event', ({ sessionId, event, payload }) => {
    /* a new quiz opened: pick it up from its snapshot */
    if (event === 'session_started') { if (!G || G.backendSessionId !== sessionId) watch(); return; }
    if (!G || G.mode !== 'screen' || G.backendSessionId !== sessionId) return;
    switch (event) {
      case 'closed': case 'screen_closed': stopGame(); break;
      case 'player_joined':
        if (G.players.some((p) => p.id === payload.participant.id)) break;
        G.players.push({
          id: payload.participant.id, name: payload.participant.name, team: payload.participant.team,
          img: mascot(payload.participant.team, mascotIdx(payload.participant.mascot)),
          bot: false, score: 0, streak: 0, correct: 0, last: null, prevRank: 0,
        });
        notify();
        break;
      case 'player_left': G.players = G.players.filter((p) => p.id !== payload.participantId); notify(); break;
      case 'phase': livePhaseEvent(payload); break;
      case 'question': liveQuestion(payload); break;
      case 'answer_count': if (G.phase === 'question') { G.liveAnswered = Math.max(G.liveAnswered || 0, payload.count); notify(); } break;
      case 'reveal': liveReveal(payload, null); screenAnswers(payload); notify(); break;
      case 'reveal_host': liveReveal(payload, payload); screenAnswers(payload); notify(); break;
      case 'final': liveFinal(payload); break;
      default: break;
    }
  });
}

export function disconnectScreen() {
  if (screenSocket) screenSocket.disconnect();
  screenSocket = null;
  if (G && G.mode === 'screen') stopGame();
}
