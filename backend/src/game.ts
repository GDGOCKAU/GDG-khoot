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
  countAnswers(sessionId: string, questionId: string): Promise<number>;
  listAnswers(sessionId: string): Promise<Answer[]>;
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
  | "invalid_option" | "game_started" | "game_closed";

export class GameError extends Error {
  constructor(public readonly code: GameErrorCode, message = code) { super(message); }
}

/** "all" = players + host. "host" = host screen only (never reaches players). */
export type EventAudience = "all" | "host";
export type EventSink = (sessionId: string, event: string, payload: unknown, audience?: EventAudience) => void;
type QuizQuestion = Quiz["questions"][number];

/** The only shape a question may take when it leaves the server towards a player. No isCorrect, no word. */
function publicQuestion(question: QuizQuestion, session: GameSession, questionCount: number) {
  return {
    order: question.order,
    questionCount,
    questionId: question.id,
    type: question.type ?? "mc",
    text: question.text,
    timeLimitSecs: question.timeLimitSecs,
    closesAt: session.closesAt,
    code: question.type === "code" ? question.code : undefined,
    language: question.type === "code" ? question.language : undefined,
    pictureUrls: question.type === "pic" ? question.pictureUrls : undefined,
    wordLength: question.type === "pic" ? normWord(picWord(question)).length : undefined,
    // A picture question's options hold the answer word, so they never leave the server.
    options: question.type === "pic" ? [] : question.options.map(({ id, text }) => ({ id, text })),
  };
}

export const normWord = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
/** The word for a picture question: the saved word, else the correct option's text (how the editor saves it). */
function picWord(question: QuizQuestion) {
  return question.word || question.options.find((option) => option.isCorrect)?.text || "";
}
/** What every screen may know about the right answer, once revealed. */
function revealedAnswer(question: QuizQuestion) {
  if (question.type === "pic") return { correctIndex: null, word: normWord(picWord(question)) };
  return { correctIndex: question.options.findIndex((option) => option.isCorrect), word: null };
}
export type AnswerChoice = { optionId?: string; text?: string };

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
    // Gate: nothing about the questions leaves the server while the session is in LOBBY.
    // Players receive each question only through the "question" event after the host starts.
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
        questionCount: quiz.questions.length,
      },
    };
  }

  /** Validates a player socket and returns what that player may see right now. */
  async participantState(sessionId: string, participantId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session) throw new GameError("session_not_found");
    const participant = session.participants.find((item) => item.id === participantId);
    if (!participant || participant.leftAt) throw new GameError("participant_not_found");
    return this.stateFor(session, participant);
  }

  /** Validates the host socket (hostId comes from a verified JWT). */
  async hostState(sessionId: string, hostId: string) {
    const session = await this.gameRepository.findById(sessionId);
    if (!session || session.hostId !== hostId) throw new GameError("session_not_found");
    return this.stateFor(session, null);
  }

  private async stateFor(session: GameSession, participant: Participant | null) {
    const quiz = await this.quizRepository.getQuiz(session.quizId, session.hostId);
    if (!quiz) throw new GameError("quiz_not_found");
    const current = quiz.questions.find((item) => item.order === session.currentQuestionOrder) ?? null;
    const answered = participant && current ? !!(await this.gameRepository.findAnswer(participant.id, current.id)) : false;
    return {
      sessionId: session.id,
      status: session.status,
      questionCount: quiz.questions.length,
      currentQuestionOrder: session.currentQuestionOrder,
      // Only an open question is ever exposed, and only in its public shape.
      question: session.status === "ACTIVE" && current ? publicQuestion(current, session, quiz.questions.length) : null,
      answered,
      participant: participant ? { id: participant.id, name: participant.name, team: participant.team, score: participant.score, streak: participant.streak } : null,
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
    this.emit(session.id, "player_joined", { participant }, "host");
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
    const payload = publicQuestion(question, session, quiz.questions.length);
    this.emit(session.id, "phase", { phase: "ACTIVE", questionOrder: order });
    this.emit(session.id, "question", payload);
    return payload;
  }
  async answer(sessionId: string, participantId: string, questionId: string, choice: string | AnswerChoice) {
    const pick: AnswerChoice = typeof choice === "string" ? { optionId: choice } : choice;
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
    let option: QuizQuestion["options"][number] | undefined;
    if (question.type === "pic") {
      // graded on the server against the saved word; stored as the matching option id
      if (typeof pick.text !== "string") throw new GameError("invalid_option");
      const right = normWord(pick.text) !== "" && normWord(pick.text) === normWord(picWord(question));
      option = question.options.find((item) => item.isCorrect === right) ?? (right ? undefined : question.options.find((item) => !item.isCorrect));
      if (!option) throw new GameError("invalid_option");
    } else {
      option = question.options.find((item) => item.id === pick.optionId);
      if (!option) throw new GameError("invalid_option");
    }
    const optionId = option.id;

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
    // Correctness is never broadcast; the host only learns how many answers are in.
    const count = await this.gameRepository.countAnswers(sessionId, questionId);
    this.emit(sessionId, "answer_count", { questionId, count }, "host");
    return payload;
  }
  async reveal(quizId: string, hostId: string, sessionId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    const session = await this.gameRepository.findById(sessionId);
    if (!quiz || !session || session.hostId !== hostId) throw new GameError("session_not_found");
    if (session.status !== "ACTIVE") throw new GameError("invalid_phase");
    const question = quiz.questions.find((item) => item.order === session.currentQuestionOrder);
    if (!question) throw new GameError("question_not_found");
    session.status = "REVEAL";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    const { standings, answers } = await this.standings(sessionId, question.id);
    const payload = { questionId: question.id, order: question.order, ...revealedAnswer(question), standings };
    // host only: which option each player picked (pic: whether they got the word)
    const choices: Record<string, number | boolean> = {};
    for (const answer of answers) {
      choices[answer.participantId] = question.type === "pic" ? answer.isCorrect : question.options.findIndex((option) => option.id === answer.optionId);
    }
    this.emit(session.id, "phase", { phase: "REVEAL", questionId: question.id });
    this.emit(session.id, "reveal", payload);
    return { ...payload, choices };
  }
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
  leaderboard(sessionId: string) {
    return this.buildLeaderboard(sessionId);
  }
  async buildLeaderboard(sessionId: string) {
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
    this.emit(sessionId, "leaderboard", payload);
    return payload;
  }
  async next(quizId: string, hostId: string, sessionId: string) {
    const quiz = await this.quizRepository.getQuiz(quizId, hostId);
    const session = await this.gameRepository.findById(sessionId);
    if (!quiz || !session || session.hostId !== hostId) throw new GameError("session_not_found");
    // a question is always closed by a reveal before moving on; a closed question never reopens
    if (session.status !== "REVEAL") throw new GameError("invalid_phase");
    const nextOrder = (session.currentQuestionOrder ?? -1) + 1;
    if (quiz.questions.some((question) => question.order === nextOrder)) return this.showQuestion(quiz, hostId, session, nextOrder);
    session.status = "FINISHED";
    session.closesAt = this.clock();
    await this.gameRepository.save(session);
    const final = { ...(await this.buildLeaderboard(sessionId)), standings: (await this.standings(sessionId, null)).standings };
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
