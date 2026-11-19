import type { PrismaClient } from "@prisma/client";
import type { Repository, SaveQuestionInput } from "../domain.js";

export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaClient) {}

  private normalizePictureUrls(value: unknown): string[] | null {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : null;
  }

  async findAdminByEmail(email: string) {
    return this.prisma.admin.findUnique({ where: { email } });
  }

  async listQuizzes(hostId: string) {
    const quizzes = await this.prisma.quiz.findMany({ where: { hostId }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
    return quizzes.map((quiz) => ({
      ...quiz,
      questions: quiz.questions.map((question) => ({ ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) })),
    }));
  }

  async getQuiz(id: string, hostId: string) {
    const quiz = await this.prisma.quiz.findFirst({ where: { id, hostId }, include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } });
    return quiz ? { ...quiz, questions: quiz.questions.map((question) => ({ ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) })) } : null;
  }

  async createQuiz(input: { title: string; description?: string | null; hostId: string }) {
    const quiz = await this.prisma.quiz.create({ data: input, include: { questions: { include: { options: true } } } });
    return { ...quiz, questions: quiz.questions.map((question) => ({ ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) })) };
  }

  async updateQuiz(id: string, hostId: string, input: { title?: string; description?: string | null; isPublished?: boolean }) {
    const existing = await this.prisma.quiz.findFirst({ where: { id, hostId } });
    if (!existing) return null;
    const updated = await this.prisma.quiz.update({ where: { id }, data: input, include: { questions: { include: { options: true } } } });
    return { ...updated, questions: updated.questions.map((question) => ({ ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) })) };
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
    type?: string;
    code?: string;
    language?: string;
    pictureUrls?: string[];
    word?: string;
  }) {
    const question = await this.prisma.question.create({
      data: {
        quizId: input.quizId,
        text: input.text,
        order: input.order,
        timeLimitSecs: input.timeLimitSecs,
        type: input.type ?? "mc",
        code: input.code,
        language: input.language,
        pictureUrls: input.pictureUrls ?? undefined,
        word: input.word,
        options: { create: input.options },
      },
      include: { options: true },
    });
    return { ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) };
  }
  async saveQuiz(input: {
    quizId?: string;
    hostId: string;
    title: string;
    description?: string;
    isPublished: boolean;
    topic?: string;
    questions: SaveQuestionInput[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const quiz = input.quizId
        ? await tx.quiz.findFirst({ where: { id: input.quizId, hostId: input.hostId } })
        : null;
      if (input.quizId && !quiz) throw new Error("quiz_not_found");

      const saved = quiz
        ? await tx.quiz.update({
            where: { id: quiz.id },
            data: { title: input.title, description: input.description ?? null, topic: input.topic ?? null, isPublished: input.isPublished },
          })
        : await tx.quiz.create({
            data: { title: input.title, description: input.description ?? null, topic: input.topic ?? null, isPublished: input.isPublished, hostId: input.hostId },
          });

      await tx.question.deleteMany({ where: { quizId: saved.id } });
      await tx.question.createMany({
        data: input.questions.map((question) => ({
          quizId: saved.id,
          text: question.text,
          order: question.order,
          timeLimitSecs: question.timeLimitSecs,
          type: question.type ?? "mc",
          code: question.code,
          language: question.language,
          pictureUrls: question.pictureUrls ?? undefined,
          word: question.word,
          imageUrl: question.imageUrl ?? null,
          points: question.points ?? 1,
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
      const result = await tx.quiz.findUniqueOrThrow({
        where: { id: saved.id },
        include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
      });
      return {
        ...result,
        questions: result.questions.map((question) => ({ ...question, pictureUrls: this.normalizePictureUrls(question.pictureUrls) })),
      };
    });
  }
}
