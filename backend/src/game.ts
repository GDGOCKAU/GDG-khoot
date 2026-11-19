import { randomInt, randomUUID } from "node:crypto";
import type { Quiz } from "./domain.js";

export type GameStatus = "LOBBY" | "ACTIVE" | "REVEAL" | "FINISHED" | "CANCELLED";
export type GameSession = {
  id: string;
  quizId: string;
  hostId: string;
  pin: string;
  status: GameStatus;
  currentQuestionOrder: number | null;
  questionStartedAt: Date | null;
  closesAt: Date | null;
  participants: Participant[];
};
export type Participant = {
  id: string;
  sessionId: string;
  name: string;
  mascot: string;
  team: string;
  score: number;
  streak: number;
  leftAt: Date | null;
};
export type Answer = {
  id: string;
  sessionId: string;
  participantId: string;
  questionId: string;
  optionId: string;
  isCorrect: boolean;
  points: number;
  respondedAt: Date;
};

export interface GameRepository {
  findByPin(pin: string): Promise<GameSession | null>;
  findById(id: string): Promise<GameSession | null>;
  create(input: { quizId: string; hostId: string }): Promise<GameSession>;
  save(session: GameSession): Promise<GameSession>;
  join(sessionId: string, input: { name: string; mascot: string; team: string }): Promise<Participant | "duplicate">;
  leave(sessionId: string, participantId: string): Promise<boolean>;
  findParticipant(sessionId: string, participantId: string): Promise<Participant | null>;
  findAnswer(participantId: string, questionId: string): Promise<Answer | null>;
  createAnswer(answer: Omit<Answer, "id">): Promise<Answer>;
  updateParticipantScore(participantId: string, score: number, streak: number): Promise<void>;
}

export class MemoryGameRepository implements GameRepository {
  readonly sessions = new Map<string, GameSession>();
  readonly answers = new Map<string, Answer>();

  async findByPin(pin: string) {
    return [...this.sessions.values()].find((session) => session.pin === pin) ?? null;
  }
  async findById(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async create(input: { quizId: string; hostId: string }) {
    let pin = "";
    do { pin = String(randomInt(100000, 1000000)); } while (await this.findByPin(pin));
    const session: GameSession = {
      id: randomUUID(), quizId: input.quizId, hostId: input.hostId, pin,
      status: "LOBBY", currentQuestionOrder: null, questionStartedAt: null, closesAt: null, participants: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }
  async save(session: GameSession) {
    this.sessions.set(session.id, session);
    return session;
  }
  async join(sessionId: string, input: { name: string; mascot: string; team: string }) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "LOBBY") return "duplicate";
    if (session.participants.some((participant) => participant.name.toLowerCase() === input.name.toLowerCase() && !participant.leftAt)) return "duplicate";
    const participant: Participant = { id: randomUUID(), sessionId, name: input.name, mascot: input.mascot, team: input.team, score: 0, streak: 0, leftAt: null };
    session.participants.push(participant);
    return participant;
  }
  async leave(sessionId: string, participantId: string) {
    const session = this.sessions.get(sessionId);
    const participant = session?.participants.find((item) => item.id === participantId);
    if (!participant) return false;
    participant.leftAt = new Date();
    return true;
  }
  async findParticipant(sessionId: string, participantId: string) {
    return this.sessions.get(sessionId)?.participants.find((participant) => participant.id === participantId) ?? null;
  }
  async findAnswer(participantId: string, questionId: string) {
    return [...this.answers.values()].find((answer) => answer.participantId === participantId && answer.questionId === questionId) ?? null;
  }
  async createAnswer(answer: Omit<Answer, "id">) {
    if (await this.findAnswer(answer.participantId, answer.questionId)) throw new Error("answer_already_submitted");
    const saved = { ...answer, id: randomUUID() };
    this.answers.set(saved.id, saved);
    return saved;
  }
  async updateParticipantScore(participantId: string, score: number, streak: number) {
    for (const session of this.sessions.values()) {
      const participant = session.participants.find((item) => item.id === participantId);
      if (participant) { participant.score = score; participant.streak = streak; return; }
    }
  }
}

export type GameErrorCode =
  | "session_not_found" | "quiz_not_found" | "invalid_phase" | "duplicate_participant"
  | "participant_not_found" | "question_not_found" | "answer_closed" | "answer_already_submitted"
  | "invalid_option" | "game_started" | "game_closed";

export class GameError extends Error {
  constructor(public readonly code: GameErrorCode, message = code) { super(message); }
}

export type EventSink = (sessionId: string, event: string, payload: unknown) => void;

export class GameService {
  constructor(
    private readonly quizRepository: { getQuiz(id: string, hostId: string): Promise<Quiz | null> },
    private readonly gameRepository: GameRepository,
    private emit: EventSink = () => undefined,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  setEmitter(emit: EventSink) {
    this.emit = emit;
  }

  async lookupByPin(pin: string) {
    const session = await this.gameRepository.findByPin(pin);
    if (!session) throw new GameError("session_not_found");
    if (session.status === "ACTIVE" || session.status === "REVEAL") throw new GameError("game_started");
    if (session.status === "FINISHED" || session.status === "CANCELLED") throw new GameError("game_closed");
    const quiz = await this.quizRepository.getQuiz(session.quizId, session.hostId);
    if (!quiz || !quiz.isPublished || quiz.questions.length === 0) throw new GameError("invalid_phase");
    return {
      sessionId: session.id,
      pin: session.pin,
      status: session.status,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description ?? null,
        isPublished: quiz.isPublished,
        topic: "Other",
        pin: session.pin,
        questions: quiz.questions
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((question) => ({
            id: question.id,
            text: question.text,
            order: question.order,
            timeLimitSecs: question.timeLimitSecs,
            type: question.type ?? "mc",
            code: question.type === "code" ? question.code : undefined,
            language: question.type === "code" ? question.language : undefined,
            pictureUrls: question.type === "pic" ? question.pictureUrls : undefined,
            options: question.options.map((option) => ({ id: option.id, text: option.text })),
          })),
      },
    };
  }

  async createSession(quizId: string, hostId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    if (!quiz.isPublished || quiz.questions.length === 0) throw new GameError("invalid_phase");
    const session = await this.gameRepository.create({ quizId, hostId });
    this.emit(session.id, "session_created", { sessionId: session.id, pin: session.pin, status: session.status });
    this.emit(session.id, "phase", { phase: "LOBBY", sessionId: session.id });
    return session;
  }
  async joinByPin(pin: string, input: { name: string; mascot: string; team: string }) {
    const session = await this.gameRepository.findByPin(pin);
    if (!session) throw new GameError("session_not_found");
    if (session.status !== "LOBBY") throw new GameError("invalid_phase");
    const participant = await this.gameRepository.join(session.id, input);
    if (participant === "duplicate") throw new GameError("duplicate_participant");
    this.emit(session.id, "player_joined", { participant });
    return participant;
  }
  async start(quizId: string, hostId: string, sessionId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    if (!quiz.isPublished || quiz.questions.length === 0) throw new GameError("invalid_phase");
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId) throw new GameError("session_not_found");
    if (session.status !== "LOBBY") throw new GameError("invalid_phase");
    if (quiz.questions.length === 0) throw new GameError("question_not_found");
    return this.showQuestion(quiz, hostId, session, 0);
  }
  async showQuestion(quiz: Quiz, hostId: string, session: GameSession, order: number) {
    if (session.hostId !== hostId) throw new GameError("session_not_found");
    const question = quiz.questions.find((item) => item.order === order);
    if (!question) throw new GameError("question_not_found");
    const now = this.clock();
    session.status = "ACTIVE";
    session.currentQuestionOrder = order;
    session.questionStartedAt = now;
    session.closesAt = new Date(now.getTime() + question.timeLimitSecs * 1000);
    await this.gameRepository.save(session);
    const payload = {
      order,
      questionId: question.id,
      type: question.type ?? "mc",
      text: question.text,
      timeLimitSecs: question.timeLimitSecs,
      closesAt: session.closesAt,
      code: question.type === "code" ? question.code : undefined,
      language: question.type === "code" ? question.language : undefined,
      pictureUrls: question.type === "pic" ? question.pictureUrls : undefined,
      options: question.options.map(({ id, text }) => ({ id, text })),
    };
    this.emit(session.id, "phase", { phase: "ACTIVE", questionOrder: order });
    this.emit(session.id, "question", payload);
    return payload;
  }
  async answer(sessionId: string, participantId: string, questionId: string, optionId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    if (session.status !== "ACTIVE") throw new GameError("invalid_phase");
    if (!session.closesAt || this.clock().getTime() >= session.closesAt.getTime()) throw new GameError("answer_closed");
    if (await this.gameRepository.findAnswer(participantId, questionId)) throw new GameError("answer_already_submitted");
    const participant = await this.gameRepository.findParticipant(sessionId, participantId);
    if (!participant || participant.leftAt) throw new GameError("participant_not_found");
    const quiz = await this.quizRepository.getQuiz(session.quizId, session.hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    const question = quiz.questions.find((item) => item.id === questionId);
    if (!question || question.order !== session.currentQuestionOrder) throw new GameError("question_not_found");
    const option = question.options.find((item) => item.id === optionId);
    if (!option) throw new GameError("invalid_option");

    const elapsedMs = this.clock().getTime() - (session.questionStartedAt?.getTime() ?? this.clock().getTime());
    const elapsedRatio = Math.max(0, Math.min(1, elapsedMs / (question.timeLimitSecs * 1000)));
    const speedPoints = option.isCorrect ? Math.round(500 * (1 - elapsedRatio)) : 0;
    const streak = option.isCorrect ? participant.streak + 1 : 0;
    const streakPoints = option.isCorrect ? Math.min(300, Math.max(0, streak - 1) * 50) : 0;
    const points = option.isCorrect ? 1000 + speedPoints + streakPoints : 0;
    await this.gameRepository.createAnswer({
      sessionId, participantId, questionId, optionId,
      isCorrect: option.isCorrect, points, respondedAt: this.clock(),
    });
    await this.gameRepository.updateParticipantScore(participantId, participant.score + points, streak);
    const payload = { questionId, optionId, isCorrect: option.isCorrect, points, speedPoints, streakPoints };
    this.emit(sessionId, "answer", payload);
    this.emit(sessionId, "result", { participantId, ...payload });
    return payload;
  }
  async reveal(quizId: string, hostId: string, sessionId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    const session = await this.gameRepository.findById(sessionId);
    if (!quiz || !session || session.hostId !== hostId) throw new GameError("session_not_found");
    if (session.status !== "ACTIVE") throw new GameError("invalid_phase");
    session.status = "REVEAL";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    const question = quiz.questions.find((item) => item.order === session.currentQuestionOrder);
    if (!question) throw new GameError("question_not_found");
    const payload = { questionId: question.id, correctOptionId: question.options.find((option) => option.isCorrect)?.id ?? null };
    this.emit(session.id, "phase", { phase: "REVEAL", questionId: question.id });
    this.emit(session.id, "reveal", payload);
    return payload;
  }
  leaderboard(sessionId: string) {
    return this.buildLeaderboard(sessionId);
  }
  async buildLeaderboard(sessionId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const players = session.participants.filter((participant) => !participant.leftAt).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const teams = new Map<string, number>();
    for (const player of players) teams.set(player.team, (teams.get(player.team) ?? 0) + player.score);
    const payload = { players, teams: [...teams].map(([team, score]) => ({ team, score })).sort((a, b) => b.score - a.score) };
    this.emit(sessionId, "leaderboard", payload);
    return payload;
  }
  async next(quizId: string, hostId: string, sessionId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    const session = await this.gameRepository.findById(sessionId);
    if (!quiz || !session || session.hostId !== hostId) throw new GameError("session_not_found");
    const nextOrder = (session.currentQuestionOrder ?? -1) + 1;
    if (quiz.questions.some((question) => question.order === nextOrder)) return this.showQuestion(quiz, hostId, session, nextOrder);
    session.status = "FINISHED";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    const final = await this.buildLeaderboard(sessionId);
    this.emit(sessionId, "phase", { phase: "FINISHED" });
    this.emit(sessionId, "final", final);
    return final;
  }
  async leave(sessionId: string, participantId: string) {
    if (!(await this.gameRepository.leave(sessionId, participantId))) throw new GameError("participant_not_found");
    this.emit(sessionId, "player_left", { participantId });
  }
  async cancel(quizId: string, hostId: string, sessionId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId || session.quizId !== quizId) throw new GameError("session_not_found");
    session.status = "CANCELLED";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    this.emit(sessionId, "phase", { phase: "CANCELLED", sessionId });
    this.emit(sessionId, "session_cancelled", { sessionId });
    return session;
  }
}
