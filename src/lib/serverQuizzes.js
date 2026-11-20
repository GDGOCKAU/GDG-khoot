/* The server is the only source of quizzes. These load them into the in-memory store. */
import { apiRequest, assetUrl } from '../api/client';
import { TEAM_KEYS, TOPICS } from './constants';
import { DB, notify, quizById } from './store';

const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || '');

/* a topic typed on another device still gets a colour here */
function knownTopic(name) {
  const t = typeof name === 'string' && name.trim() ? name.trim() : 'Other';
  if (!TOPICS[t]) TOPICS[t] = { c: TEAM_KEYS[Object.keys(TOPICS).length % 4], icon: 'star' };
  return t;
}

/* server quiz -> the shape the editor and host screen use */
export function fromServer(quiz, lastHosted = null) {
  return {
    id: quiz.id,
    title: quiz.title,
    topic: knownTopic(quiz.topic),
    desc: quiz.description || '',
    status: quiz.isPublished ? 'ready' : 'draft',
    pin: String(100000 + Math.floor(Math.random() * 900000)),
    lastHosted: lastHosted ? Date.parse(lastHosted) : null,
    questions: (quiz.questions || []).map((question) => {
      const type = question.type || 'mc', options = question.options || [];
      const answers = type === 'pic' ? ['', '', '', ''] : options.map((option) => option.text);
      while (answers.length < 4) answers.push('');
      return {
        type,
        text: question.text,
        answers,
        correct: type === 'pic' ? -1 : options.findIndex((option) => option.isCorrect),
        time: question.timeLimitSecs,
        points: question.points ?? 1,
        img: question.imageUrl ? assetUrl(question.imageUrl) : null,
        code: question.code || '',
        lang: question.language || 'Dart',
        pics: (question.pictureUrls || []).map(assetUrl),
        word: type === 'pic' ? (question.word || options.find((option) => option.isCorrect)?.text || '') : '',
      };
    }),
  };
}

/* admin: every quiz of this admin, replacing whatever was in memory; returns the dashboard stats */
export async function loadQuizzes() {
  const [items, stats] = await Promise.all([apiRequest('/api/v1/quizzes'), apiRequest('/api/v1/stats').catch(() => null)]);
  DB.quizzes = items.map((quiz) => fromServer(quiz, stats?.lastHosted?.[quiz.id]));
  DB.loaded = true;
  notify();
  return stats;
}

/* admin: one quiz (opening /admin/edit/:id or /host/:id directly); null when it is not on the server */
export async function ensureQuiz(id) {
  const have = quizById(id);
  if (have) return have;
  if (!isUuid(id)) return null;
  try {
    const quiz = fromServer(await apiRequest(`/api/v1/quizzes/${id}`));
    if (!quizById(id)) DB.quizzes.unshift(quiz);
    notify();
    return quiz;
  } catch { return null; }
}

/* public home page: published quizzes, title/topic/count only */
export async function loadPublicQuizzes() {
  const items = await apiRequest('/api/v1/public/quizzes');
  return items.map((q) => ({ id: q.id, title: q.title, desc: q.description || '', topic: knownTopic(q.topic), questionCount: q.questionCount }));
}
