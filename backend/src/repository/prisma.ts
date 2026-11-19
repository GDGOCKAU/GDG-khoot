import type { PrismaClient } from "@prisma/client";
import type { Repository } from "../domain.js";

export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAdminByEmail(email: string) {
    return this.prisma.admin.findUnique({ where: { email } });
  }

  async listQuizzes(hostId: string) {
    return this.prisma.quiz.findMany({ where: { hostId }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
  }

  async getQuiz(id: string, hostId: string) {
    return this.prisma.quiz.findFirst({ where: { id, hostId }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
  }

  async createQuiz(input: { title: string; description?: string | null; hostId: string }) {
    return this.prisma.quiz.create({ data: input, include: { questions: { include: { options: true } } } });
  }

  async updateQuiz(id: string, hostId: string, input: { title?: string; description?: string | null; isPublished?: boolean }) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, hostId } });
    if (!quiz) return null;
    return this.prisma.quiz.update({ where: { id }, data: input, include: { questions: { include: { options: true } } } });
  }

  async deleteQuiz(id: string, hostId: string) {
    const result = await this.prisma.quiz.deleteMany({ where: { id, hostId } });
    return result.count === 1;
  }

  async createQuestion(input: {
    quizId: string;
    text: string;
    order: number;
    timeLimitSecs?: number;
    options: Array<{ text: string; isCorrect: boolean }>;
  }) {
    return this.prisma.question.create({
      data: {
        quizId: input.quizId,
        text: input.text,
        order: input.order,
        timeLimitSecs: input.timeLimitSecs,
        options: { create: input.options },
      },
      include: { options: true },
    });
  }
}
