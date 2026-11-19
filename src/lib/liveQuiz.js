import { UI } from './engine';

/* A live quiz only lives in memory: by-pin carries the title and question count,
   never the questions. Questions arrive one by one over the socket after the host starts. */
export function syncLiveQuiz(live) {
  const quiz = {
    id: live.quiz.id,
    title: live.quiz.title,
    topic: live.quiz.topic || 'Other',
    desc: live.quiz.description || '',
    status: 'live',
    pin: live.pin,
    lastHosted: null,
    live: true,
    liveSessionId: live.sessionId,
    livePin: live.pin,
    questionCount: live.quiz.questionCount || 0,
    questions: [],
  };
  UI.liveQuiz = quiz;
  UI.look = {
    key: `live:${quiz.id}`,
    quizId: quiz.id,
    live: true,
    sessionId: live.sessionId,
    pin: live.pin,
    name: UI.look?.name || '',
    team: 'blue',
    idx: 0,
  };
  return quiz;
}
