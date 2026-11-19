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
  async saveQuiz(input: {
    quizId?: string;
    hostId: string;
    title: string;
    description?: string;
    isPublished: boolean;
    questions: Array<{ text: string; order: number; timeLimitSecs: number; options: Array<{ text: string; isCorrect: boolean }> }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const quiz = input.quizId
        ? await tx.quiz.findFirst({ where: { id: input.quizId, hostId: input.hostId } })
        : null;
      if (input.quizId && !quiz) throw new Error("quiz_not_found");

      const saved = quiz
        ? await tx.quiz.update({
            where: { id: quiz.id },
            data: { title: input.title, description: input.description ?? null, isPublished: input.isPublished },
          })
        : await tx.quiz.create({
            data: { title: input.title, description: input.description ?? null, isPublished: input.isPublished, hostId: input.hostId },
          });

      await tx.question.deleteMany({ where: { quizId: saved.id } });
      await tx.question.createMany({
        data: input.questions.map((question) => ({
          quizId: saved.id,
          text: question.text,
          order: question.order,
          timeLimitSecs: question.timeLimitSecs,
        })),
      });
      const savedQuestions = await tx.question.findMany({
        where: { quizId: saved.id },
        orderBy: { order: "asc" },
      });
      for (const question of savedQuestions) {
        const source = input.questions.find((item) => item.order === question.order);
        if (!source) continue;
        await tx.option.createMany({
          data: source.options.map((option) => ({
            questionId: question.id,
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        });
      }
      return tx.quiz.findUniqueOrThrow({
        where: { id: saved.id },
        include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
      });
    });
  }
}
