import { randomUUID } from "node:crypto";
import type { Admin, Question, Quiz, Repository } from "../domain.js";

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
}
