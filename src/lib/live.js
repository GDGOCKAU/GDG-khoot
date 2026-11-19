/* LIVE SESSION WIRING — the only place that talks to the game server over Socket.IO.
   Player: game:join (server validates the participant and returns the current state).
   Host:   host:join with the admin JWT. Phases move only when the server says so. */
import { apiRequest, getStoredToken } from '../api/client';
import { connectSocket } from '../api/socket';
import { mascot } from './constants';
import { G, exitGame, livePhase, liveQuestion, onLiveAnswer, onLiveHostOpen } from './engine';
import { notify } from './store';
import { toast } from './ui';

const mascotIdx = (m) => { const n = Number(String(m || '').split('-')[1]); return Number.isInteger(n) ? n : 0; };

/* apply what the server says this player may see right now */
function applyPlayerState(state) {
  if (!G || !G.live || !state) return;
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
      if (!res || !res.ok) { toast('You are no longer in this game.'); exitGame(); return; }
      applyPlayerState(res.state);
    });
  });
  socket.on('question', (q) => liveQuestion(q));
  socket.on('reveal', () => livePhase('reveal'));
  socket.on('final', () => livePhase('final'));
  socket.on('session_cancelled', () => exitGame());
  onLiveAnswer((qq, choice) => {
    const optionId = qq.optionIds ? qq.optionIds[choice] : null;
    if (!optionId) return;
    apiRequest(`/api/v1/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ participantId, questionId: qq.questionId, optionId }),
    }).catch((error) => {
      if (error.status !== 409) toast(error.body?.error === 'answer_closed' ? "Time's up, your answer didn't count." : 'Your answer could not be sent.');
    });
  });
  return socket;
}

export function connectLiveHost(sessionId) {
  const socket = connectSocket();
  G.socket = socket;
  socket.on('connect', () => {
    socket.emit('host:join', sessionId, getStoredToken(), (res) => {
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
  onLiveHostOpen((i) => {
    const path = i === 0 ? 'start' : 'next';
    return apiRequest(`/api/v1/sessions/${sessionId}/${path}`, { method: 'POST', body: JSON.stringify({ quizId: G.quiz.id }) })
      .catch((error) => { toast('The server did not open the question. Press Skip to retry.'); throw error; });
  });
  return socket;
}
