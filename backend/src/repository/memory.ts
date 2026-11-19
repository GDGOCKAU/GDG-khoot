import { randomUUID } from "node:crypto";
import type { Admin, Question, Quiz, Repository, SaveQuestionInput } from "../domain.js";

export class MemoryRepository implements Repository {
  readonly admins: Admin[] = [];
  readonly quizzes: Quiz[] = [];

  async findAdminByEmail(email: string) {
    return this.admins.find((admin) => admin.email === email) ?? null;
  }

  async listQuizzes(hostId: string) {
    return this.quizzes.filter((quiz) => quiz.hostId === hostId);
  }

  async getQuiz(id: string, hostId: string) {
    return this.quizzes.find((quiz) => quiz.id === id && quiz.hostId === hostId) ?? null;
  }

  async createQuiz(input: { title: string; description?: string; hostId: string }) {
    const quiz: Quiz = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      isPublished: false,
      hostId: input.hostId,
      questions: [],
    };
    this.quizzes.push(quiz);
    return quiz;
  }

  async updateQuiz(id: string, hostId: string, input: { title?: string; description?: string; isPublished?: boolean }) {
    const quiz = await this.getQuiz(id, hostId);
    if (!quiz) return null;
    Object.assign(quiz, input);
    return quiz;
  }

  async deleteQuiz(id: string, hostId: string) {
    const index = this.quizzes.findIndex((quiz) => quiz.id === id && quiz.hostId === hostId);
    if (index < 0) return false;
    this.quizzes.splice(index, 1);
    return true;
  }

  async createQuestion(input: {
    quizId: string;
    text: string;
    order: number;
    timeLimitSecs?: number;
    options: Array<{ text: string; isCorrect: boolean }>;
  }) {
    const quiz = this.quizzes.find((item) => item.id === input.quizId);
    if (!quiz || quiz.questions.some((question) => question.order === input.order)) return null;
    const question: Question = {
      id: randomUUID(),
      quizId: input.quizId,
      text: input.text,
      order: input.order,
      timeLimitSecs: input.timeLimitSecs ?? 20,
      options: input.options.map((option) => ({ ...option, id: randomUUID() })),
    };
    quiz.questions.push(question);
    return question;
  }
  async saveQuiz(input: {
    quizId?: string;
    hostId: string;
    title: string;
    description?: string;
    topic?: string;
    isPublished: boolean;
    questions: SaveQuestionInput[];
  }) {
    let quiz = input.quizId ? await this.getQuiz(input.quizId, input.hostId) : null;
    if (!quiz) {
      quiz = await this.createQuiz({ title: input.title, description: input.description, hostId: input.hostId });
    } else {
      Object.assign(quiz, { title: input.title, description: input.description, isPublished: input.isPublished });
    }
    quiz.isPublished = input.isPublished;
    quiz.topic = input.topic ?? null;
    quiz.questions = input.questions.map((question) => ({
      id: randomUUID(),
      quizId: quiz!.id,
      text: question.text,
      order: question.order,
      timeLimitSecs: question.timeLimitSecs,
      type: question.type ?? "mc",
      code: question.code ?? null,
      language: question.language ?? null,
      pictureUrls: question.pictureUrls ?? null,
      word: question.word ?? null,
      imageUrl: question.imageUrl ?? null,
      points: question.points ?? 1,
      options: question.options.map((option) => ({ id: randomUUID(), text: option.text, isCorrect: option.isCorrect })),
    }));
    return quiz;
  }
}
