/* Quiz save rules, mirroring the front-end editor (handoff: "same rule on the server when saving").
   Limits apply to every save (drafts autosave); the per-type completeness rules apply on publish. */
import { z } from "zod";
import type { SaveQuestionInput } from "./domain.js";

export const ALLOWED_TIMES = [5, 10, 15, 20, 30, 60] as const;
export const LANGUAGES = ["Dart", "Python", "JavaScript", "Kotlin", "Java", "C++", "Go", "SQL"] as const;

/** Uploaded files only (/uploads/... or http URLs). Data URLs would put base64 into PostgreSQL. */
export const imageUrl = z.string().max(500).refine((value) => !value.startsWith("data:"), "upload images first; data URLs are not stored");

export const normWord = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const questionSchema = z.object({
  text: z.string().trim().max(160),
  order: z.number().int().nonnegative(),
  timeLimitSecs: z.number().int().refine((value) => (ALLOWED_TIMES as readonly number[]).includes(value), "time must be 5, 10, 15, 20, 30 or 60 seconds"),
  points: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  options: z.array(z.object({ text: z.string().trim().max(80), isCorrect: z.boolean() })).max(4),
  type: z.enum(["mc", "tf", "code", "pic"]).optional(),
  code: z.string().max(10000).optional(),
  language: z.string().trim().max(40).optional(),
  pictureUrls: z.array(imageUrl).max(20).optional(),
  word: z.string().trim().max(20).regex(/^[A-Za-z0-9 ]*$/, "letters, digits and spaces only").optional(),
  imageUrl: imageUrl.nullable().optional(),
});

export const saveQuizSchema = z.object({
  quizId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().max(90).optional(),
  topic: z.string().trim().min(1).max(20).optional(),
  isPublished: z.boolean(),
  questions: z.array(questionSchema).min(1),
});
export type SaveQuizBody = z.infer<typeof saveQuizSchema>;

/** Same wording as the editor's qProblem; '' means the question is complete. */
export function questionProblem(question: SaveQuestionInput): string {
  const type = question.type ?? "mc";
  if (!question.text.trim()) return "needs a question";
  if (type === "pic") {
    if ((question.pictureUrls ?? []).length < 2) return "needs 2 pictures";
    return normWord(question.word) ? "" : "needs the answer word";
  }
  const correct = question.options.filter((option) => option.isCorrect);
  if (type === "tf") return correct.length === 1 && question.options.length === 2 ? "" : "needs a correct answer";
  if (type === "code" && !(question.code ?? "").trim()) return "needs code";
  if (correct.length !== 1 || !correct[0].text.trim()) return "needs a correct answer";
  return question.options.filter((option) => option.text.trim()).length < 2 ? "needs 2 answers" : "";
}

/** Server-owned shapes: picture options come from the word, true/false options are fixed, empty slots dropped. */
export function normalizeQuestion(question: SaveQuestionInput): SaveQuestionInput {
  const type = question.type ?? "mc";
  const base = { ...question, type, points: question.points ?? 1 };
  if (type === "pic") {
    const word = normWord(question.word);
    return { ...base, word, imageUrl: null, code: undefined, language: undefined,
      options: word ? [{ text: word, isCorrect: true }, { text: `NOT_${word}`, isCorrect: false }] : [] };
  }
  if (type === "tf") {
    const trueIsCorrect = question.options[0]?.isCorrect === true;
    const falseIsCorrect = question.options[1]?.isCorrect === true;
    return { ...base, pictureUrls: undefined, word: undefined, code: undefined, language: undefined,
      options: [{ text: "True", isCorrect: trueIsCorrect }, { text: "False", isCorrect: falseIsCorrect && !trueIsCorrect }] };
  }
  return {
    ...base,
    pictureUrls: undefined, word: undefined,
    imageUrl: type === "code" ? null : question.imageUrl ?? null,
    code: type === "code" ? question.code : undefined,
    language: type === "code" ? question.language : undefined,
    options: question.options.filter((option) => option.text.trim() || option.isCorrect),
  };
}
