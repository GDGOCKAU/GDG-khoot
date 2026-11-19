import { upsertQuiz } from './store';
import { UI } from './engine';

export function syncLiveQuiz(live) {
  const quiz = {
    id: live.quiz.id,
    title: live.quiz.title,
    topic: live.quiz.topic || 'Other',
    desc: live.quiz.description || '',
    status: 'ready',
    pin: live.pin,
    lastHosted: null,
    questions: (live.quiz.questions || []).map((question) => ({
      type: 'mc',
      text: question.text,
      answers: (question.options || []).map((option) => option.text),
      correct: -1,
      time: question.timeLimitSecs,
      points: 1,
      img: null,
    })),
  };
  upsertQuiz(quiz);
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
