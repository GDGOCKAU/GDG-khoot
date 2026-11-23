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
  updatedAt?: Date;
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
  /** A player who left comes back to their seat (same name, score and team). */
  rejoin(sessionId: string, participantId: string): Promise<boolean>;
  /** Kick: the player and their answers are removed from the session. */
  removeParticipant(sessionId: string, participantId: string): Promise<boolean>;
  findParticipant(sessionId: string, participantId: string): Promise<Participant | null>;
  findAnswer(participantId: string, questionId: string): Promise<Answer | null>;
  createAnswer(answer: Omit<Answer, "id">): Promise<Answer>;
  updateParticipantScore(participantId: string, score: number, streak: number): Promise<void>;
  countAnswers(sessionId: string, questionId: string): Promise<number>;
  listAnswers(sessionId: string): Promise<Answer[]>;
  listSessions(hostId: string): Promise<GameSession[]>;
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
    session.updatedAt = new Date();
    this.sessions.set(session.id, session);
    return session;
  }
  async listSessions(hostId: string) {
    return [...this.sessions.values()].filter((session) => session.hostId === hostId);
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
  async rejoin(sessionId: string, participantId: string) {
    const participant = this.sessions.get(sessionId)?.participants.find((item) => item.id === participantId);
    if (!participant) return false;
    participant.leftAt = null;
    return true;
  }
  async removeParticipant(sessionId: string, participantId: string) {
    const session = this.sessions.get(sessionId);
    const index = session ? session.participants.findIndex((item) => item.id === participantId) : -1;
    if (!session || index < 0) return false;
    session.participants.splice(index, 1);
    for (const [id, answer] of this.answers) if (answer.participantId === participantId) this.answers.delete(id);
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
  async countAnswers(sessionId: string, questionId: string) {
    return [...this.answers.values()].filter((answer) => answer.sessionId === sessionId && answer.questionId === questionId).length;
  }
  async listAnswers(sessionId: string) {
    return [...this.answers.values()].filter((answer) => answer.sessionId === sessionId);
  }
}


export type GameErrorCode =
  | "session_not_found" | "quiz_not_found" | "invalid_phase" | "duplicate_participant"
  | "participant_not_found" | "question_not_found" | "answer_closed" | "answer_already_submitted"
  | "invalid_option" | "game_started" | "game_closed" | "game_locked" | "no_players"
  | "power_ups_off" | "power_up_used" | "power_up_not_allowed" | "quiz_in_live_game" | "kicked";

export class GameError extends Error {
  constructor(public readonly code: GameErrorCode, message = code) { super(message); }
}

/** "all" = players + host. "host" = host screen only. { participantId } = one player's phone only. */
export type EventAudience = "all" | "host" | { participantId: string };
export type EventSink = (sessionId: string, event: string, payload: unknown, audience?: EventAudience) => void;
type QuizQuestion = Quiz["questions"][number];

/** Phases the server owns (handoff "Game flow"); every screen just shows the current one. */
export type Phase = "lobby" | "ready" | "question" | "reveal" | "leaderboard" | "next" | "teams" | "podium" | "final" | "cancelled";
export type Timings = { ready: number; reveal: number; leaderboard: number; next: number; teams: number; podium: number; earlyClose: number };
export const DEFAULT_TIMINGS: Timings = { ready: 3000, reveal: 5500, leaderboard: 7000, next: 3000, teams: 8000, podium: 9000, earlyClose: 600 };
export type PowerUpKind = "double" | "fifty";
type PowerState = { double: boolean; fifty: boolean; doubleOn: string | null; removed: { questionId: string; optionIds: string[] } | null };

type Live = {
  quiz: Quiz;
  questions: QuizQuestion[];
  phase: Phase;
  index: number;
  endsAt: number | null;
  durationMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  next: (() => Promise<void>) | null;
  locked: boolean;
  powerUps: boolean;
  power: Map<string, PowerState>;
  reveal: (ReturnType<GameService["revealPayload"]> & { closedBy?: "all_answered" | "time" | "skip" }) | null;
  results: Map<string, unknown>;
  hostReveal: unknown;
  final: unknown;
  /** kicked players (and the devices they joined from) may not come back to this session */
  kicked: Set<string>;
  kickedDevices: Set<string>;
  devices: Map<string, string>;
};

export const normWord = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** The word for a picture question: the saved word, else the correct option's text (how the editor saves it). */
function picWord(question: QuizQuestion) {
  return question.word || question.options.find((option) => option.isCorrect)?.text || "";
}
const pointsOf = (question: QuizQuestion) => (question.points === 0 || question.points === 2 ? question.points : 1);

/** A question is playable when complete; invalid ones are skipped when a game starts (handoff). */
function playable(question: QuizQuestion) {
  const type = question.type ?? "mc";
  if (!question.text.trim()) return false;
  if (type === "pic") return (question.pictureUrls ?? []).length >= 2 && !!normWord(picWord(question));
  const correct = question.options.filter((option) => option.isCorrect);
  if (correct.length !== 1) return false;
  if (type === "tf") return question.options.length === 2;
  if (type === "code" && !(question.code ?? "").trim()) return false;
  return question.options.filter((option) => option.text.trim()).length >= 2;
}

/** The only shape a question may take when it leaves the server. No isCorrect, no word. */
function publicQuestion(question: QuizQuestion, index: number, questionCount: number, closesAt: Date | null, powerUps: boolean) {
  const type = question.type ?? "mc";
  return {
    order: index,
    questionCount,
    questionId: question.id,
    type,
    text: question.text,
    timeLimitSecs: question.timeLimitSecs,
    points: pointsOf(question),
    closesAt,
    imageUrl: type === "mc" || type === "tf" ? question.imageUrl ?? null : null,
    code: type === "code" ? question.code : undefined,
    language: type === "code" ? question.language : undefined,
    pictureUrls: type === "pic" ? question.pictureUrls : undefined,
    wordLength: type === "pic" ? normWord(picWord(question)).length : undefined,
    // A picture question's options hold the answer word, so they never leave the server.
    options: type === "pic" ? [] : question.options.map(({ id, text }) => ({ id, text })),
    powerUps,
  };
}
export type AnswerChoice = { optionId?: string; text?: string };

/** Handoff scoring: round(1000 * (1 - min(t,T)/(2T))) * p + 100 * min(s-1, 5); p = 0 earns nothing. */
export function scoreAnswer(input: { correct: boolean; elapsedMs: number; limitMs: number; points: number; streak: number }) {
  if (!input.correct || input.points === 0) return { points: 0, speedPoints: 0, streakPoints: 0 };
  const t = Math.max(0, Math.min(input.elapsedMs, input.limitMs));
  const speedPoints = Math.round(1000 * (1 - t / (2 * input.limitMs))) * input.points;
  const streakPoints = 100 * Math.min(Math.max(input.streak - 1, 0), 5);
  return { points: speedPoints + streakPoints, speedPoints, streakPoints };
}

export class GameService {
  private readonly live = new Map<string, Live>();
  /** The session the big audience screen follows: the newest one that has not been closed. */
  private screenSessionId: string | null = null;
  private readonly timings: Timings;

  constructor(
    private readonly quizRepository: { getQuiz(id: string, hostId: string): Promise<Quiz | null> },
    private readonly gameRepository: GameRepository,
    private emit: EventSink = () => undefined,
    private readonly clock: () => Date = () => new Date(),
    timings: Partial<Timings> = {},
  ) {
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
  }

  setEmitter(emit: EventSink) {
    this.emit = emit;
  }

  /* ---------- lookup, join, state ---------- */

  async lookupByPin(pin: string) {
    const session = await this.gameRepository.findByPin(pin);
    if (!session) throw new GameError("session_not_found");
    if (session.status === "FINISHED" || session.status === "CANCELLED") throw new GameError("game_closed");
    if (session.status !== "LOBBY") throw new GameError("game_started");
    const live = await this.ensureLive(session);
    if (live.phase !== "lobby") throw new GameError("game_started");
    if (live.locked) throw new GameError("game_locked");
    // Gate: nothing about the questions leaves the server while the session is in the lobby.
    return {
      sessionId: session.id,
      pin: session.pin,
      status: session.status,
      quiz: {
        id: live.quiz.id,
        title: live.quiz.title,
        description: live.quiz.description ?? null,
        isPublished: live.quiz.isPublished,
        topic: live.quiz.topic || "Other",
        pin: session.pin,
        questionCount: live.questions.length,
      },
    };
  }

  async joinByPin(pin: string, input: { name: string; mascot: string; team: string; deviceId?: string }) {
    const session = await this.gameRepository.findByPin(pin);
    if (!session) throw new GameError("session_not_found");
    if (session.status !== "LOBBY") throw new GameError("invalid_phase");
    const live = await this.ensureLive(session);
    if (live.phase !== "lobby") throw new GameError("invalid_phase");
    if (live.locked) throw new GameError("game_locked");
    // a device the host kicked from this session cannot join it again
    if (input.deviceId && live.kickedDevices.has(input.deviceId)) throw new GameError("kicked");
    // only these three fields are stored (callers may pass a whole request body)
    const participant = await this.gameRepository.join(session.id, { name: input.name, mascot: input.mascot, team: input.team });
    if (participant === "duplicate") throw new GameError("duplicate_participant");
    if (input.deviceId) live.devices.set(participant.id, input.deviceId);
    this.emit(session.id, "player_joined", { participant }, "host");
    return participant;
  }

  /** Validates a player socket and returns everything that player may see right now. */
  async participantState(sessionId: string, participantId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const live = await this.ensureLive(session);
    if (live.kicked.has(participantId)) throw new GameError("kicked");
    const participant = session.participants.find((item) => item.id === participantId);
    if (!participant) throw new GameError("participant_not_found");
    if (participant.leftAt) {
      // their seat is kept: a player who closed the page or left comes back as themselves, even after Start
      if (session.status === "FINISHED" || session.status === "CANCELLED") throw new GameError("participant_not_found");
      await this.gameRepository.rejoin(session.id, participant.id);
      participant.leftAt = null;
      this.emit(session.id, "player_joined", { participant }, "host");
    }
    const current = live.phase === "question" ? live.questions[live.index] : null;
    const answered = current ? !!(await this.gameRepository.findAnswer(participant.id, current.id)) : false;
    return {
      ...this.common(session, live),
      answered,
      participant: { id: participant.id, name: participant.name, team: participant.team, mascot: participant.mascot, score: participant.score, streak: participant.streak },
      result: live.phase === "reveal" || live.phase === "leaderboard" ? live.results.get(participant.id) ?? null : null,
      powerUps: this.powerView(live, participant.id),
    };
  }

  /** Validates the host socket (hostId comes from a verified JWT). */
  async hostState(sessionId: string, hostId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId) throw new GameError("session_not_found");
    const live = await this.ensureLive(session);
    const current = live.phase === "question" ? live.questions[live.index] : null;
    return {
      ...this.common(session, live),
      answeredCount: current ? await this.gameRepository.countAnswers(sessionId, current.id) : 0,
      standings: (await this.standings(sessionId, null)).standings,
      hostReveal: live.phase === "reveal" || live.phase === "leaderboard" ? live.hostReveal : null,
    };
  }

  /** Read-only view for the audience screen: what the players already see, plus names and scores. No host rights. */
  async screenState() {
    const sessionId = this.screenSessionId;
    const session = sessionId ? await this.gameRepository.findById(sessionId) : null;
    if (!session || session.status === "CANCELLED") { this.screenSessionId = null; return null; }
    const live = await this.ensureLive(session);
    const current = live.phase === "question" ? live.questions[live.index] : null;
    const reveal = live.phase === "reveal" || live.phase === "leaderboard" ? live.hostReveal as { choices?: unknown } | null : null;
    const { choices: _choices, ...hostReveal } = reveal ?? {};
    return {
      ...this.common(session, live),
      answeredCount: current ? await this.gameRepository.countAnswers(session.id, current.id) : 0,
      standings: (await this.standings(session.id, null)).standings,
      hostReveal: reveal ? hostReveal : null,
    };
  }

  private common(session: GameSession, live: Live) {
    const current = live.questions[live.index];
    return {
      sessionId: session.id,
      quizId: session.quizId,
      pin: session.pin,
      quizTitle: live.quiz.title,
      topic: live.quiz.topic || "Other",
      status: session.status,
      questionCount: live.questions.length,
      phase: this.phasePayload(session.id, live),
      // only an open question is ever exposed, and only in its public shape
      question: live.phase === "question" && current ? publicQuestion(current, live.index, live.questions.length, session.closesAt, live.powerUps) : null,
      reveal: live.phase === "reveal" || live.phase === "leaderboard" ? live.reveal : null,
      final: live.phase === "teams" || live.phase === "podium" || live.phase === "final" ? live.final : null,
    };
  }

  /* ---------- host controls ---------- */

  async createSession(quizId: string, hostId: string, options: { powerUps?: boolean } = {}) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    if (!quiz.isPublished || !quiz.questions.some(playable)) throw new GameError("invalid_phase");
    const session = await this.gameRepository.create({ quizId, hostId });
    const live = this.newLive(quiz);
    live.powerUps = !!options.powerUps;
    this.live.set(session.id, live);
    this.screenSessionId = session.id;
    // the audience screen is waiting for a quiz: tell it this one just opened
    this.emit(session.id, "session_started", { sessionId: session.id }, "host");
    return { ...session, powerUps: live.powerUps, locked: live.locked };
  }

  /** Lobby settings: lock the room (any time) and power-ups (before Start only). */
  async settings(hostId: string, sessionId: string, input: { locked?: boolean; powerUps?: boolean }) {
    const { session, live } = await this.hostSession(hostId, sessionId);
    if (input.powerUps !== undefined) {
      if (live.phase !== "lobby") throw new GameError("invalid_phase");
      live.powerUps = input.powerUps;
    }
    if (input.locked !== undefined) live.locked = input.locked;
    this.emitPhase(session.id, live);
    return { locked: live.locked, powerUps: live.powerUps };
  }

  async start(hostId: string, sessionId: string) {
    const { session, live } = await this.hostSession(hostId, sessionId);
    if (session.status !== "LOBBY" || live.phase !== "lobby") throw new GameError("invalid_phase");
    if (!session.participants.some((participant) => !participant.leftAt)) throw new GameError("no_players");
    session.status = "ACTIVE";
    await this.gameRepository.save(session);
    this.setPhase(session.id, live, "ready", this.timings.ready, () => this.openQuestion(session.id, 0));
    return this.phasePayload(session.id, live);
  }

  /** Skip ends whatever timed phase is running (handoff: "Skip to end any timed phase early"). */
  async skip(hostId: string, sessionId: string) {
    const { session, live } = await this.hostSession(hostId, sessionId);
    if (!live.next) throw new GameError("invalid_phase");
    await this.advance(session.id, live);
    return this.phasePayload(session.id, live);
  }

  async cancel(hostId: string, sessionId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId) throw new GameError("session_not_found");
    const live = this.live.get(sessionId);
    if (live?.timer) clearTimeout(live.timer);
    this.live.delete(sessionId);
    if (session.status !== "FINISHED") {
      session.status = "CANCELLED";
      session.closesAt = this.clock();
      await this.gameRepository.save(session);
      this.emit(sessionId, "closed", { sessionId, reason: "host_ended" });
    } else if (this.screenSessionId === sessionId) {
      // a finished game the host dismisses: players keep their results, the audience screen goes back to waiting
      this.emit(sessionId, "screen_closed", { sessionId }, "host");
    }
    if (this.screenSessionId === sessionId) this.screenSessionId = null;
    return { sessionId, status: session.status };
  }

  /** Before a quiz is deleted: refuse while one of its games is being played; close lobbies that never started. */
  async releaseQuiz(hostId: string, quizId: string) {
    const open = (await this.gameRepository.listSessions(hostId))
      .filter((session) => session.quizId === quizId && session.status !== "FINISHED" && session.status !== "CANCELLED");
    if (open.some((session) => session.status !== "LOBBY")) throw new GameError("quiz_in_live_game");
    for (const session of open) await this.cancel(hostId, session.id);
  }

  async leave(sessionId: string, participantId: string) {
    if (!(await this.gameRepository.leave(sessionId, participantId))) throw new GameError("participant_not_found");
    this.emit(sessionId, "player_left", { participantId }, "host");
    // the question may now be complete without them
    const live = this.live.get(sessionId);
    if (live?.phase === "question") await this.maybeCloseEarly(sessionId, live);
  }

  /** Host removes a player (lobby or during the game). Their answers go too, so counts, teams and the
      leaderboard no longer include them; their phone is told, and neither it nor the player can return. */
  async kick(hostId: string, sessionId: string, participantId: string) {
    const { session, live } = await this.hostSession(hostId, sessionId);
    if (!session.participants.some((item) => item.id === participantId)) throw new GameError("participant_not_found");
    await this.gameRepository.removeParticipant(session.id, participantId);
    live.kicked.add(participantId);
    const device = live.devices.get(participantId);
    if (device) live.kickedDevices.add(device);
    live.power.delete(participantId);
    live.results.delete(participantId);
    this.emit(session.id, "kicked", { sessionId: session.id }, { participantId });
    this.emit(session.id, "player_left", { participantId, kicked: true }, "host");
    const current = live.questions[live.index];
    if (live.phase === "question" && current) {
      const fresh = await this.gameRepository.findById(session.id);
      const count = await this.gameRepository.countAnswers(session.id, current.id);
      this.emit(session.id, "answer_count", { questionId: current.id, count, total: fresh ? fresh.participants.filter((item) => !item.leftAt).length : 0 }, "host");
      // the others may all have answered already
      await this.maybeCloseEarly(session.id, live, count);
    } else if (live.reveal && current && ["reveal", "leaderboard", "suspense"].includes(live.phase)) {
      await this.refreshReveal(session.id, live, current);
    }
    return { participantId };
  }

  leaderboard(sessionId: string) {
    return this.buildLeaderboard(sessionId);
  }

  /* ---------- answers and power-ups ---------- */

  async answer(sessionId: string, participantId: string, questionId: string, choice: string | AnswerChoice) {
    const pick: AnswerChoice = typeof choice === "string" ? { optionId: choice } : choice;
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const live = await this.ensureLive(session);
    if (session.status !== "ACTIVE" || live.phase !== "question") throw new GameError("invalid_phase");
    if (!session.closesAt || this.clock().getTime() >= session.closesAt.getTime()) throw new GameError("answer_closed");
    const question = live.questions[live.index];
    if (!question || question.id !== questionId) throw new GameError("question_not_found");
    const participant = session.participants.find((item) => item.id === participantId);
    if (!participant || participant.leftAt) throw new GameError("participant_not_found");
    if (await this.gameRepository.findAnswer(participantId, questionId)) throw new GameError("answer_already_submitted");
    let option: QuizQuestion["options"][number] | undefined;
    if (question.type === "pic") {
      // graded on the server against the saved word; stored as the matching option id
      if (typeof pick.text !== "string") throw new GameError("invalid_option");
      const right = normWord(pick.text) !== "" && normWord(pick.text) === normWord(picWord(question));
      option = question.options.find((item) => item.isCorrect === right);
    } else {
      option = question.options.find((item) => item.id === pick.optionId);
    }
    if (!option) throw new GameError("invalid_option");

    // time is measured on the server: question opening -> answer arrival
    const elapsedMs = this.clock().getTime() - (session.questionStartedAt?.getTime() ?? this.clock().getTime());
    const streak = option.isCorrect ? participant.streak + 1 : 0;
    const scored = scoreAnswer({ correct: option.isCorrect, elapsedMs, limitMs: question.timeLimitSecs * 1000, points: pointsOf(question), streak });
    const power = live.power.get(participantId);
    const doubled = !!power && power.doubleOn === question.id && scored.points > 0;
    const points = doubled ? scored.points * 2 : scored.points;
    try {
      await this.gameRepository.createAnswer({ sessionId, participantId, questionId, optionId: option.id, isCorrect: option.isCorrect, points, respondedAt: this.clock() });
    } catch {
      throw new GameError("answer_already_submitted");
    }
    await this.gameRepository.updateParticipantScore(participantId, participant.score + points, streak);
    participant.score += points; participant.streak = streak;
    const count = await this.gameRepository.countAnswers(sessionId, questionId);
    // correctness is never broadcast; the host only learns how many answers are in
    this.emit(sessionId, "answer_count", { questionId, count, total: session.participants.filter((item) => !item.leftAt).length }, "host");
    await this.maybeCloseEarly(sessionId, live, count);
    return { questionId, optionId: option.id, isCorrect: option.isCorrect, points, speedPoints: scored.speedPoints, streakPoints: scored.streakPoints, doubled };
  }

  /** Double Points (x2 if this answer is right) or 50/50 (MC only; the server picks two wrong options). Once each per player. */
  async usePowerUp(sessionId: string, participantId: string, kind: PowerUpKind) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const live = await this.ensureLive(session);
    if (!live.powerUps) throw new GameError("power_ups_off");
    if (live.phase !== "question") throw new GameError("invalid_phase");
    const participant = session.participants.find((item) => item.id === participantId && !item.leftAt);
    if (!participant) throw new GameError("participant_not_found");
    const question = live.questions[live.index];
    if (await this.gameRepository.findAnswer(participantId, question.id)) throw new GameError("answer_already_submitted");
    const power = live.power.get(participantId) ?? { double: false, fifty: false, doubleOn: null, removed: null };
    if (power[kind]) throw new GameError("power_up_used");
    if (kind === "double") {
      if (pointsOf(question) === 0) throw new GameError("power_up_not_allowed");
      power.double = true; power.doubleOn = question.id;
      live.power.set(participantId, power);
      return { kind, questionId: question.id };
    }
    const wrong = question.options.filter((option) => !option.isCorrect && option.text.trim());
    if ((question.type ?? "mc") !== "mc" || wrong.length < 2) throw new GameError("power_up_not_allowed");
    // remove two wrong answers, always leaving the right one and at least one wrong one
    const removed = wrong.map((option) => ({ option, r: Math.random() })).sort((a, b) => a.r - b.r)
      .slice(0, Math.min(2, wrong.length - 1)).map((item) => item.option.id);
    power.fifty = true; power.removed = { questionId: question.id, optionIds: removed };
    live.power.set(participantId, power);
    return { kind, questionId: question.id, removedOptionIds: removed };
  }

  private powerView(live: Live, participantId: string) {
    const power = live.power.get(participantId);
    const current = live.questions[live.index];
    return {
      enabled: live.powerUps,
      doubleUsed: !!power?.double,
      fiftyUsed: !!power?.fifty,
      doubleActive: !!current && power?.doubleOn === current.id,
      removedOptionIds: current && power?.removed?.questionId === current.id ? power.removed.optionIds : [],
    };
  }

  /* ---------- the phase machine ---------- */

  private newLive(quiz: Quiz): Live {
    const questions = quiz.questions.slice().sort((a, b) => a.order - b.order).filter(playable);
    return { quiz, questions, phase: "lobby", index: -1, endsAt: null, durationMs: 0, timer: null, next: null, locked: false, powerUps: false, power: new Map(), reveal: null, results: new Map(), hostReveal: null, final: null, kicked: new Set(), kickedDevices: new Set(), devices: new Map() };
  }

  /** Live state is in memory; after a server restart it is rebuilt from the stored session. */
  private async ensureLive(session: GameSession): Promise<Live> {
    const existing = this.live.get(session.id);
    if (existing) return existing;
    const quiz = await this.quizRepository.getQuiz(session.quizId, session.hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    const live = this.newLive(quiz);
    this.live.set(session.id, live);
    live.index = session.currentQuestionOrder ?? -1;
    if (session.status === "ACTIVE" && live.index >= 0) {
      const left = Math.max(0, (session.closesAt?.getTime() ?? 0) - this.clock().getTime());
      this.setPhase(session.id, live, "question", left, () => this.closeQuestion(session.id, live.index), live.questions[live.index]?.timeLimitSecs * 1000);
    } else if (session.status === "ACTIVE") {
      this.setPhase(session.id, live, "ready", this.timings.ready, () => this.openQuestion(session.id, 0));
    } else if (session.status === "REVEAL") {
      this.setPhase(session.id, live, "leaderboard", this.hold(live, this.timings.leaderboard), () => this.afterLeaderboard(session.id));
    } else if (session.status === "FINISHED") {
      live.phase = "final";
      live.final = await this.finalPayload(session.id);
    } else if (session.status === "CANCELLED") live.phase = "cancelled";
    return live;
  }

  private async hostSession(hostId: string, sessionId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId) throw new GameError("session_not_found");
    if (session.status === "CANCELLED" || session.status === "FINISHED") throw new GameError("game_closed");
    return { session, live: await this.ensureLive(session) };
  }

  private phasePayload(sessionId: string, live: Live) {
    const upcomingIndex = live.phase === "ready" ? 0 : live.phase === "next" ? live.index + 1 : -1;
    const upcoming = live.questions[upcomingIndex];
    return {
      sessionId,
      phase: live.phase,
      index: live.index,
      questionCount: live.questions.length,
      endsAt: live.endsAt,
      durationMs: live.durationMs,
      serverNow: this.clock().getTime(),
      // type and points only, so the countdown screens can show the right answer colours / "double points"
      upcoming: upcoming ? { index: upcomingIndex, type: upcoming.type ?? "mc", points: pointsOf(upcoming) } : null,
      locked: live.locked,
      powerUps: live.powerUps,
      // false: Reveal and Leaderboard wait for the host's Next (POST /skip) instead of a timer
      autoAdvance: live.quiz.autoAdvance !== false,
    };
  }

  /** How long Reveal / Leaderboard stay up: their timing, or no timer when the host moves on by hand. */
  private hold(live: Live, ms: number) {
    return live.quiz.autoAdvance === false ? null : ms;
  }

  private emitPhase(sessionId: string, live: Live) {
    this.emit(sessionId, "phase", this.phasePayload(sessionId, live));
  }

  private setPhase(sessionId: string, live: Live, phase: Phase, ms: number | null, next: (() => Promise<void>) | null, durationMs = ms ?? 0) {
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    live.phase = phase;
    live.durationMs = durationMs;
    live.endsAt = ms === null ? null : this.clock().getTime() + ms;
    live.next = next;
    if (next && ms !== null) {
      live.timer = setTimeout(() => { void this.advance(sessionId, live).catch(() => undefined); }, ms);
    }
    this.emitPhase(sessionId, live);
  }

  /** Runs the pending step exactly once, whether the timer, Skip or "everyone answered" got there first. */
  private async advance(sessionId: string, live: Live) {
    const next = live.next;
    if (!next || this.live.get(sessionId) !== live) return;
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    live.next = null;
    await next();
  }

  private async openQuestion(sessionId: string, index: number) {
    const live = this.live.get(sessionId);
    const session = await this.gameRepository.findById(sessionId);
    if (!live || !session) return;
    const question = live.questions[index];
    if (!question) return this.finish(sessionId);
    const now = this.clock();
    session.status = "ACTIVE";
    session.currentQuestionOrder = index;
    session.questionStartedAt = now;
    session.closesAt = new Date(now.getTime() + question.timeLimitSecs * 1000);
    await this.gameRepository.save(session);
    live.index = index;
    live.reveal = null; live.results = new Map(); live.hostReveal = null;
    this.setPhase(sessionId, live, "question", question.timeLimitSecs * 1000, () => this.closeQuestion(sessionId, index));
    this.emit(sessionId, "question", publicQuestion(question, index, live.questions.length, session.closesAt, live.powerUps));
  }

  private async maybeCloseEarly(sessionId: string, live: Live, count?: number) {
    const question = live.questions[live.index];
    const session = await this.gameRepository.findById(sessionId);
    if (!question || !session || live.phase !== "question") return;
    const active = session.participants.filter((participant) => !participant.leftAt).length;
    const answered = count ?? await this.gameRepository.countAnswers(sessionId, question.id);
    if (active > 0 && answered >= active) {
      // everyone is in: close shortly, once
      const index = live.index;
      this.setPhase(sessionId, live, "question", this.timings.earlyClose, () => this.closeQuestion(sessionId, index), live.durationMs);
    }
  }

  revealPayload(question: QuizQuestion, index: number, answers: Answer[], total: number) {
    const type = question.type ?? "mc";
    const counts = type === "pic"
      ? { right: answers.filter((answer) => answer.isCorrect).length, wrong: answers.filter((answer) => !answer.isCorrect).length, none: total - answers.length }
      : question.options.map((option) => answers.filter((answer) => answer.optionId === option.id).length);
    return {
      questionId: question.id,
      index,
      correctIndex: type === "pic" ? null : question.options.findIndex((option) => option.isCorrect),
      word: type === "pic" ? normWord(picWord(question)) : null,
      counts,
      total,
    };
  }

  private async closeQuestion(sessionId: string, index: number) {
    const live = this.live.get(sessionId);
    const session = await this.gameRepository.findById(sessionId);
    if (!live || !session || live.index !== index) return;
    const question = live.questions[index];
    const closedAt = this.clock();
    const elapsedMs = closedAt.getTime() - (session.questionStartedAt?.getTime() ?? closedAt.getTime());
    session.status = "REVEAL";
    session.closesAt = closedAt;
    await this.gameRepository.save(session);
    const { standings, answers } = await this.standings(sessionId, question.id);
    // why it closed: everyone answered, the timer ran out, or the host skipped it
    const everyone = standings.length > 0 && standings.every((player) => answers.some((answer) => answer.participantId === player.id));
    const closedBy: "all_answered" | "time" | "skip" = everyone ? "all_answered" : elapsedMs < question.timeLimitSecs * 1000 - 250 ? "skip" : "time";
    live.reveal = { ...this.revealPayload(question, index, answers, standings.length), closedBy };
    // each phone gets only its own result
    standings.forEach((player, i) => {
      const answer = answers.find((item) => item.participantId === player.id);
      const result = {
        questionId: question.id,
        answered: !!answer,
        choice: answer ? (question.type === "pic" ? null : question.options.findIndex((option) => option.id === answer.optionId)) : null,
        correct: !!answer?.isCorrect,
        points: answer?.points ?? 0,
        doubled: !!answer && live.power.get(player.id)?.doubleOn === question.id && answer.points > 0,
        streak: player.streak,
        rank: i + 1,
        total: player.score,
        players: standings.length,
      };
      live.results.set(player.id, result);
      this.emit(sessionId, "result", result, { participantId: player.id });
    });
    // host: who picked what, and the leaderboard
    const choices: Record<string, number | boolean> = {};
    for (const answer of answers) {
      choices[answer.participantId] = question.type === "pic" ? answer.isCorrect : question.options.findIndex((option) => option.id === answer.optionId);
    }
    live.hostReveal = { ...live.reveal, choices, standings };
    this.setPhase(sessionId, live, "reveal", this.hold(live, this.timings.reveal), async () => {
      this.setPhase(sessionId, live, "leaderboard", this.hold(live, this.timings.leaderboard), () => this.afterLeaderboard(sessionId));
    });
    this.emit(sessionId, "reveal", live.reveal);
    this.emit(sessionId, "reveal_host", live.hostReveal, "host");
  }

  /** Kick during Reveal / Leaderboard: recount this question without the removed player. */
  private async refreshReveal(sessionId: string, live: Live, question: QuizQuestion) {
    const { standings, answers } = await this.standings(sessionId, question.id);
    live.reveal = { ...this.revealPayload(question, live.index, answers, standings.length), closedBy: live.reveal?.closedBy };
    const choices: Record<string, number | boolean> = {};
    for (const answer of answers) {
      choices[answer.participantId] = question.type === "pic" ? answer.isCorrect : question.options.findIndex((option) => option.id === answer.optionId);
    }
    live.hostReveal = { ...live.reveal, choices, standings };
    this.emit(sessionId, "reveal", live.reveal);
    this.emit(sessionId, "reveal_host", live.hostReveal, "host");
  }

  private async afterLeaderboard(sessionId: string) {
    const live = this.live.get(sessionId);
    if (!live) return;
    if (live.index + 1 >= live.questions.length) return this.finish(sessionId);
    this.setPhase(sessionId, live, "next", this.timings.next, () => this.openQuestion(sessionId, live.index + 1));
  }

  private async finalPayload(sessionId: string) {
    const { standings } = await this.standings(sessionId, null);
    const { teams } = await this.buildLeaderboard(sessionId, false);
    return { teams, top3: standings.slice(0, 3), ranking: standings };
  }

  /** One "final" event with team standings, the top 3 and the full ranking, then the three end screens. */
  private async finish(sessionId: string) {
    const live = this.live.get(sessionId);
    const session = await this.gameRepository.findById(sessionId);
    if (!live || !session) return;
    session.status = "FINISHED";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    live.final = await this.finalPayload(sessionId);
    this.emit(sessionId, "final", live.final);
    this.setPhase(sessionId, live, "teams", this.timings.teams, async () => {
      this.setPhase(sessionId, live, "podium", this.timings.podium, async () => {
        this.setPhase(sessionId, live, "final", null, null);
      });
    });
  }

  /* ---------- standings, stats ---------- */

  /** Per-player standings computed from stored answers (score, streak, correct count, this question's result). */
  private async standings(sessionId: string, questionId: string | null) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const all = await this.gameRepository.listAnswers(sessionId);
    const answers = questionId ? all.filter((answer) => answer.questionId === questionId) : [];
    const standings = session.participants.filter((participant) => !participant.leftAt).map((participant) => {
      const mine = all.filter((answer) => answer.participantId === participant.id);
      const last = answers.find((answer) => answer.participantId === participant.id);
      return {
        id: participant.id, name: participant.name, team: participant.team, mascot: participant.mascot,
        score: participant.score, streak: participant.streak,
        correct: mine.filter((answer) => answer.isCorrect).length,
        answered: !!last, lastOk: !!last?.isCorrect, lastPts: last?.points ?? 0,
      };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return { standings, answers };
  }

  async buildLeaderboard(sessionId: string, emit = true) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const players = session.participants.filter((participant) => !participant.leftAt).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    // a team scores the average of its members, so team size is not rewarded
    const teams = new Map<string, { total: number; count: number }>();
    for (const player of players) {
      const team = teams.get(player.team) ?? { total: 0, count: 0 };
      team.total += player.score; team.count += 1;
      teams.set(player.team, team);
    }
    const payload = { players, teams: [...teams].map(([team, { total, count }]) => ({ team, score: Math.round(total / count), members: count })).sort((a, b) => b.score - a.score) };
    if (emit) this.emit(sessionId, "leaderboard", payload, "host");
    return payload;
  }

  /** Dashboard totals from finished sessions (handoff "Game history"): games, players, accuracy, lastHosted. */
  async stats(hostId: string) {
    const sessions = (await this.gameRepository.listSessions(hostId)).filter((session) => session.status === "FINISHED");
    let players = 0, correct = 0, possible = 0;
    const lastHosted: Record<string, string> = {};
    for (const session of sessions) {
      const quiz = await this.quizRepository.getQuiz(session.quizId, hostId);
      const questionCount = quiz ? quiz.questions.filter(playable).length : 0;
      const count = session.participants.length;
      const answers = await this.gameRepository.listAnswers(session.id);
      players += count;
      correct += answers.filter((answer) => answer.isCorrect).length;
      possible += count * questionCount;
      const at = (session.updatedAt ?? session.closesAt ?? new Date(0)).toISOString();
      if (!lastHosted[session.quizId] || lastHosted[session.quizId] < at) lastHosted[session.quizId] = at;
    }
    return { gamesHosted: sessions.length, players, accuracy: possible ? correct / possible : null, lastHosted };
  }
}
