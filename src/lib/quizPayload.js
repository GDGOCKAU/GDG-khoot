/* Editor-shaped quiz -> the server's save API. Shared by the editor and the CSV import,
   so both store quizzes the same way (pictures uploaded as files first, never base64). */
import { API_URL, apiRequest } from '../api/client';
import { norm, qType } from './questions';

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}
export function backendQuestions(d) {
  return d.questions.map((question, index) => {
    const type = qType(question);
    let options = [];
    if (type === 'tf') {
      options = [
        { text: 'True', isCorrect: question.correct === 0 },
        { text: 'False', isCorrect: question.correct === 1 },
      ];
    } else if (type === 'pic') {
      options = [
        { text: norm(question.word), isCorrect: true },
        { text: norm(question.word) ? 'NOT_' + norm(question.word) : '', isCorrect: false },
      ];
    } else {
      /* empty optional answers are left out, or publishing would reject the quiz */
      options = (question.answers || []).slice(0, 4).map((text, optionIndex) => ({
        text: String(text || ''),
        isCorrect: question.correct === optionIndex,
      })).filter((option) => option.text.trim() || option.isCorrect);
    }
    return {
      text: String(question.text || ''),
      order: index,
      timeLimitSecs: Number(question.time || 20),
      options,
      type,
      code: type === 'code' ? String(question.code || '') : undefined,
      language: type === 'code' ? String(question.lang || '') : undefined,
      pictureUrls: type === 'pic' ? (question.pics || []).map(storedUrl) : undefined,
      word: type === 'pic' ? norm(question.word) : undefined,
      points: [0, 1, 2].includes(question.points) ? question.points : 1,
      imageUrl: (type === 'mc' || type === 'tf') && question.img ? storedUrl(question.img) : null,
    };
  });
}
/* pictures are uploaded as files first; only their URL is saved with the quiz */
const storedUrl = (u) => (typeof u === 'string' && u.startsWith(API_URL + '/uploads/') ? u.slice(API_URL.length) : u);
const upload = async (src) => {
  if (typeof src !== 'string' || !src.startsWith('data:')) return src;
  const { url } = await apiRequest('/api/v1/uploads', { method: 'POST', body: JSON.stringify({ dataUrl: src }) });
  return API_URL + url;
};
export async function uploadPictures(d) {
  for (const question of d.questions) {
    const t = qType(question);
    if (t === 'pic') question.pics = await Promise.all((question.pics || []).map(upload));
    if ((t === 'mc' || t === 'tf') && question.img) question.img = await upload(question.img);
  }
}

/* upload any new pictures, then save; resolves with the server's quiz, rejects with the API error */
export async function saveQuizToServer(d) {
  await uploadPictures(d);
  return apiRequest('/api/v1/quizzes/save', {
    method: 'POST',
    body: JSON.stringify({
      quizId: isUuid(d.id) ? d.id : undefined,
      title: d.title.trim() || 'Untitled Quiz',
      description: d.desc || '',
      topic: d.topic || undefined,
      isPublished: d.status === 'ready',
      questions: backendQuestions(d),
    }),
  });
}
