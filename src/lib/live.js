/* LIVE SESSION WIRING — the only place that talks to the game server over Socket.IO.
   Player: game:join (server validates the participant and returns the current state).
   Host:   host:join with the admin JWT. Phases move only when the server says so. */
import { apiRequest, getStoredToken } from '../api/client';
import { connectSocket } from '../api/socket';
import { mascot } from './constants';
import { G, applyHostState, applyStandings, exitGame, livePhase, liveQuestion, newLiveGame, onLiveAnswer, onLiveHostOpen, setLiveHooks, skip, stopGame } from './engine';
import { notify } from './store';
import { toast } from './ui';

const mascotIdx = (m) => { const n = Number(String(m || '').split('-')[1]); return Number.isInteger(n) ? n : 0; };

/* apply what the server says this player may see right now */
function applyPlayerState(state) {
  if (!G || !G.live || !state) return;
  /* also restores a refreshed phone: title, count and who I am come from the server */
  if (state.quizTitle) G.quiz.title = state.quizTitle;
  if (state.pin) G.pin = state.pin;
  while (G.qs.length < (state.questionCount || 0)) G.qs.push(null);
  if (state.participant && G.me) {
    Object.assign(G.me, { name: state.participant.name, team: state.participant.team, img: mascot(state.participant.team, mascotIdx(state.participant.mascot)), score: state.participant.score, streak: state.participant.streak });
  }
  G.resuming = false;
  if (state.status === 'ACTIVE' && state.question) {
    liveQuestion(state.question);
    if (state.answered && !G.answers.me) { G.answers.me = { choice: null, t: 0 }; notify(); }
  } else if (state.status === 'REVEAL') livePhase('reveal');
  else if (state.status === 'FINISHED') livePhase('final');
  else if (state.status === 'CANCELLED') exitGame();
  else livePhase('lobby');
}

export function connectLivePlayer(sessionId, participantId) {
  const socket = connectSocket();
  G.socket = socket;
  /* runs on first connect and on every reconnect */
  socket.on('connect', () => {
    socket.emit('game:join', sessionId, participantId, (res) => {
      if (!res || !res.ok || (G && G.resuming && res.state.status === 'FINISHED')) {
        if (G && G.resuming) { forgetPlayer(); stopGame(); return; }
        toast('You are no longer in this game.'); exitGame(); return;
      }
      applyPlayerState(res.state);
    });
  });
  socket.on('question', (q) => liveQuestion(q));
  socket.on('reveal', (r) => {
    if (!G || !G.live) return;
    applyStandings(r);
    G.phase = 'reveal'; G.phaseStart = Date.now(); G.phaseEnd = Date.now() + 5500;
    notify();
  });
  socket.on('final', (f) => {
    if (!G || !G.live) return;
    applyStandings({ standings: f.standings });
    livePhase('final');
  });
  socket.on('session_cancelled', () => exitGame());
  onLiveAnswer((qq, choice) => {
    const pic = qq.type === 'pic';
    const optionId = !pic && qq.optionIds ? qq.optionIds[choice] : undefined;
    if (!pic && !optionId) return;
    apiRequest(`/api/v1/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(pic ? { participantId, questionId: qq.questionId, text: String(choice) } : { participantId, questionId: qq.questionId, optionId }),
    }).catch((error) => {
      if (error.status !== 409) toast(error.body?.error === 'answer_closed' ? "Time's up, your answer didn't count." : 'Your answer could not be sent.');
    });
  });
  return socket;
}

const forgetPlayer = () => { localStorage.removeItem('gdgParticipantId'); localStorage.removeItem('gdgSessionId'); };
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
  if (!G || !G.live || !G.participantId || G.phase === 'final') return;
  apiRequest(`/api/v1/sessions/${G.backendSessionId}/leave`, { method: 'POST', body: JSON.stringify({ participantId: G.participantId }), keepalive: true }).catch(() => {});
}

export function connectLiveHost(sessionId, onFirstState) {
  const socket = connectSocket();
  G.socket = socket;
  let first = true;
  socket.on('connect', () => {
    socket.emit('host:join', sessionId, getStoredToken(), (res) => {
      if (first && onFirstState) { first = false; onFirstState(res); return; }
      if (!res || !res.ok) toast('The server rejected the host connection. Log in again.');
    });
  });
  socket.on('player_joined', ({ participant }) => {
    if (!G || G.phase !== 'lobby') return;
    if (G.players.some((player) => player.id === participant.id)) return;
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
  socket.on('answer_count', ({ count }) => {
    if (!G || G.phase !== 'question') return;
    G.liveAnswered = Math.max(G.liveAnswered || 0, count);
    notify();
    /* everyone is in: close early, like the practice game does */
    if (G.liveAnswered >= G.players.length) { const g = G; setTimeout(() => { if (G === g && G.phase === 'question' && !G.revealing) skip(); }, 600); }
  });
  const post = (path) => apiRequest(`/api/v1/sessions/${sessionId}/${path}`, { method: 'POST', body: JSON.stringify({ quizId: G.quiz.id }) });
  setLiveHooks({
    reveal: () => post('reveal').catch((error) => { toast('Could not reveal on the server. Retrying…'); throw error; }),
    finish: () => post('next').catch(() => toast('Could not finish the game on the server.')),
    cancel: () => post('cancel').catch(() => {}),
  });
  onLiveHostOpen((i) => {
    const path = i === 0 ? 'start' : 'next';
    return apiRequest(`/api/v1/sessions/${sessionId}/${path}`, { method: 'POST', body: JSON.stringify({ quizId: G.quiz.id }) })
      .catch((error) => { toast('The server did not open the question. Press Skip to retry.'); throw error; });
  });
  return socket;
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
