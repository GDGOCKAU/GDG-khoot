import type { PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import type { Answer, GameRepository, GameSession, Participant } from "../game.js";

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPin(pin: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { pin }, include: { participants: true } });
    return session ? this.mapSession(session) : null;
  }
  async findById(id: string) {
    const session = await this.prisma.gameSession.findUnique({ where: { id }, include: { participants: true } });
    return session ? this.mapSession(session) : null;
  }
  async create(input: { quizId: string; hostId: string }) {
    let pin = "";
    let exists = true;
    while (exists) {
      pin = String(randomInt(100000, 1000000));
      exists = (await this.prisma.gameSession.count({ where: { pin } })) > 0;
    }
    const session = await this.prisma.gameSession.create({
      data: { quizId: input.quizId, hostId: input.hostId, pin },
      include: { participants: true },
    });
    return this.mapSession(session);
  }
  async save(session: GameSession) {
    const saved = await this.prisma.gameSession.update({
      where: { id: session.id },
      data: {
        status: session.status,
        currentQuestionOrder: session.currentQuestionOrder,
        questionStartedAt: session.questionStartedAt,
        closesAt: session.closesAt,
      },
      include: { participants: true },
    });
    return this.mapSession(saved);
  }
  async join(sessionId: string, input: { name: string; mascot: string; team: string }) {
    const existing = await this.prisma.participant.findFirst({
      where: { sessionId, name: { equals: input.name, mode: "insensitive" }, leftAt: null },
    });
    if (existing) return "duplicate";
    try {
      const participant = await this.prisma.participant.create({ data: { sessionId, name: input.name, mascot: input.mascot, team: input.team } });
      return this.mapParticipant(participant);
    } catch (error) {
      // only a unique-name clash is a duplicate; anything else is a real error
      if ((error as { code?: string }).code === "P2002") return "duplicate";
      throw error;
    }
  }
  async leave(sessionId: string, participantId: string) {
    const result = await this.prisma.participant.updateMany({
      where: { id: participantId, sessionId, leftAt: null },
      data: { leftAt: new Date() },
    });
    return result.count === 1;
  }
  async updateParticipant(sessionId: string, participantId: string, input: { name: string; mascot: string; team: string }) {
    const clash = await this.prisma.participant.findFirst({
      where: { sessionId, id: { not: participantId }, leftAt: null, name: { equals: input.name, mode: "insensitive" } },
    });
    if (clash) return "duplicate";
    try {
      const updated = await this.prisma.participant.update({ where: { id: participantId }, data: { name: input.name, mascot: input.mascot, team: input.team } });
      return updated.sessionId === sessionId ? this.mapParticipant(updated) : null;
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return "duplicate";
      if ((error as { code?: string }).code === "P2025") return null;
      throw error;
    }
  }
  async rejoin(sessionId: string, participantId: string) {
    const result = await this.prisma.participant.updateMany({ where: { id: participantId, sessionId }, data: { leftAt: null } });
    return result.count === 1;
  }
  async removeParticipant(sessionId: string, participantId: string) {
    // answers go with the participant (onDelete: Cascade)
    const result = await this.prisma.participant.deleteMany({ where: { id: participantId, sessionId } });
    return result.count === 1;
  }
  async findParticipant(sessionId: string, participantId: string) {
    const participant = await this.prisma.participant.findFirst({ where: { id: participantId, sessionId } });
    return participant ? this.mapParticipant(participant) : null;
  }
  async findAnswer(participantId: string, questionId: string) {
    const answer = await this.prisma.answer.findUnique({
      where: { participantId_questionId: { participantId, questionId } },
    });
    return answer ? this.mapAnswer(answer) : null;
  }
  async createAnswer(answer: Omit<Answer, "id">) {
    try {
      const saved = await this.prisma.answer.create({ data: answer });
      return this.mapAnswer(saved);
    } catch {
      throw new Error("answer_already_submitted");
    }
  }
  async updateParticipantScore(participantId: string, score: number, streak: number) {
    await this.prisma.participant.update({ where: { id: participantId }, data: { score, streak } });
  }
  async countAnswers(sessionId: string, questionId: string) {
    return this.prisma.answer.count({ where: { sessionId, questionId } });
  }
  async listSessions(hostId: string) {
    const sessions = await this.prisma.gameSession.findMany({ where: { hostId }, include: { participants: true } });
    return sessions.map((session) => this.mapSession(session));
  }
  async listAnswers(sessionId: string) {
    const answers = await this.prisma.answer.findMany({ where: { sessionId } });
    return answers.map((answer) => this.mapAnswer(answer));
  }

  private mapParticipant(participant: {
    id: string; sessionId: string; name: string; mascot: string; team: string;
    score: number; streak: number; leftAt: Date | null;
  }): Participant {
    return participant;
  }
  private mapAnswer(answer: {
    id: string; sessionId: string; participantId: string; questionId: string; optionId: string;
    isCorrect: boolean; points: number; respondedAt: Date;
  }): Answer {
    return answer;
  }
  private mapSession(session: {
    id: string; quizId: string; hostId: string; pin: string; status: string;
    currentQuestionOrder: number | null; questionStartedAt: Date | null; closesAt: Date | null; updatedAt: Date;
    participants: Array<{ id: string; sessionId: string; name: string; mascot: string; team: string; score: number; streak: number; leftAt: Date | null }>;
  }): GameSession {
    return {
      ...session,
      status: session.status as GameSession["status"],
      participants: session.participants.map((participant) => this.mapParticipant(participant)),
    };
  }
}
