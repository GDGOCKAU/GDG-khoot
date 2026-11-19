import { describe, expect, it } from "vitest";
import { GameService, MemoryGameRepository } from "../src/game.js";
import type { Quiz } from "../src/domain.js";

const quiz: Quiz = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Game",
  hostId: "admin-1",
  isPublished: true,
  questions: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      quizId: "11111111-1111-4111-8111-111111111111",
      text: "Which team wins?",
      order: 0,
      timeLimitSecs: 10,
      options: [
        { id: "33333333-3333-4333-8333-333333333333", text: "GDG", isCorrect: true },
        { id: "44444444-4444-4444-8444-444444444444", text: "Other", isCorrect: false },
      ],
    },
  ],
};

function setup(now = new Date("2026-01-01T00:00:00Z")) {
  const gameRepository = new MemoryGameRepository();
  const events: Array<{ sessionId: string; event: string; payload: unknown }> = [];
  let current = now;
  const clock = () => new Date(current);
  const quizRepository = { getQuiz: async (id: string, hostId: string) => id === quiz.id && hostId === quiz.hostId ? quiz : null };
  const service = new GameService(quizRepository, gameRepository, (sessionId, event, payload) => events.push({ sessionId, event, payload }), clock);
  return { gameRepository, service, events, setNow: (value: Date) => { current = value; } };
}

describe("live game service", () => {
  it("does not allow PIN lookup after a session starts", async () => {
    const { service } = setup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    await service.start(quiz.id, quiz.hostId, session.id);
    await expect(service.lookupByPin(session.pin)).rejects.toMatchObject({ code: "game_started" });
  });

  it("runs lobby through question, reveal, leaderboard, and final", async () => {
    const { service, events } = setup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    expect(session.pin).toMatch(/^\d{6}$/);
    const player = await service.joinByPin(session.pin, { name: "Noura", mascot: "blue", team: "Blue" });
    const question = await service.start(quiz.id, quiz.hostId, session.id);
    expect(question.options).toHaveLength(2);
    const answer = await service.answer(session.id, player.id, quiz.questions[0].id, quiz.questions[0].options[0].id);
    expect(answer.isCorrect).toBe(true);
    expect(answer.points).toBe(1500);
    await service.reveal(quiz.id, quiz.hostId, session.id);
    const leaderboard = await service.leaderboard(session.id);
    expect(leaderboard.players[0].score).toBe(1500);
    expect(leaderboard.teams[0]).toMatchObject({ team: "Blue", score: 1500 });
    await expect(service.next(quiz.id, quiz.hostId, session.id)).resolves.toMatchObject({ players: [{ name: "Noura" }] });
    expect(events.map((item) => item.event)).toContain("player_joined");
    expect(events.map((item) => item.event)).toContain("question");
    expect(events.map((item) => item.event)).toContain("reveal");
  });

  it("rejects duplicate participants and duplicate answers", async () => {
    const { service } = setup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    await service.joinByPin(session.pin, { name: "Noura", mascot: "blue", team: "Blue" });
    await expect(service.joinByPin(session.pin, { name: "noura", mascot: "red", team: "Red" }))
      .rejects.toMatchObject({ code: "duplicate_participant" });
    const player = (await service.joinByPin(session.pin, { name: "Ali", mascot: "green", team: "Green" }));
    await service.start(quiz.id, quiz.hostId, session.id);
    await service.answer(session.id, player.id, quiz.questions[0].id, quiz.questions[0].options[0].id);
    await expect(service.answer(session.id, player.id, quiz.questions[0].id, quiz.questions[0].options[1].id))
      .rejects.toMatchObject({ code: "answer_already_submitted" });
  });

  it("rejects answers after closesAt", async () => {
    const { service, setNow } = setup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    const player = await service.joinByPin(session.pin, { name: "Ali", mascot: "green", team: "Green" });
    await service.start(quiz.id, quiz.hostId, session.id);
    setNow(new Date("2026-01-01T00:00:10.001Z"));
    await expect(service.answer(session.id, player.id, quiz.questions[0].id, quiz.questions[0].options[0].id))
      .rejects.toMatchObject({ code: "answer_closed" });
  });

  it("applies speed and streak scoring", async () => {
    const { service } = setup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    const player = await service.joinByPin(session.pin, { name: "Speed", mascot: "yellow", team: "Yellow" });
    await service.start(quiz.id, quiz.hostId, session.id);
    const fast = await service.answer(session.id, player.id, quiz.questions[0].id, quiz.questions[0].options[0].id);
    expect(fast.points).toBe(1500);
  });
});

describe("server-authoritative round rules", () => {
  const picQuiz: Quiz = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Pics", hostId: "admin-1", isPublished: true,
    questions: [{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", quizId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "pic",
      text: "Put the pictures together", order: 0, timeLimitSecs: 30, pictureUrls: ["/img/door.svg", "/img/man.svg"],
      options: [
        { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", text: "DOORMAN", isCorrect: true },
        { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", text: "NOT_DOORMAN", isCorrect: false },
      ],
    }],
  };
  function picSetup() {
    const events: Array<{ event: string; payload: unknown; audience?: string }> = [];
    const service = new GameService({ getQuiz: async (id) => (id === picQuiz.id ? picQuiz : id === quiz.id ? quiz : null) }, new MemoryGameRepository(),
      (_s, event, payload, audience) => events.push({ event, payload, audience }), () => new Date("2026-01-01T00:00:00Z"));
    return { service, events };
  }

  it("never sends a picture question's word and grades the typed word on the server", async () => {
    const { service, events } = picSetup();
    const session = await service.createSession(picQuiz.id, "admin-1");
    const right = await service.joinByPin(session.pin, { name: "Right", mascot: "blue-0", team: "blue" });
    const wrong = await service.joinByPin(session.pin, { name: "Wrong", mascot: "red-0", team: "red" });
    const q = await service.start(picQuiz.id, "admin-1", session.id);
    expect(q.options).toEqual([]);
    expect(q.wordLength).toBe(7);
    expect(JSON.stringify(events.filter((e) => e.event === "question"))).not.toContain("DOORMAN");
    expect((await service.answer(session.id, right.id, q.questionId, { text: "door man" })).isCorrect).toBe(true);
    expect((await service.answer(session.id, wrong.id, q.questionId, { text: "DOORMEN" })).isCorrect).toBe(false);
    const reveal = await service.reveal(picQuiz.id, "admin-1", session.id);
    expect(reveal.word).toBe("DOORMAN");
    expect(reveal.choices).toEqual({ [right.id]: true, [wrong.id]: false });
    const shared = events.find((e) => e.event === "reveal")!.payload as Record<string, unknown>;
    expect(shared).not.toHaveProperty("choices");
    expect((shared.standings as Array<{ name: string; lastOk: boolean }>).map((p) => [p.name, p.lastOk])).toEqual([["Right", true], ["Wrong", false]]);
  });

  it("refuses Next before Reveal and scores teams by average", async () => {
    const { service } = picSetup();
    const session = await service.createSession(quiz.id, quiz.hostId);
    const a = await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.joinByPin(session.pin, { name: "B", mascot: "blue-1", team: "blue" });
    const c = await service.joinByPin(session.pin, { name: "C", mascot: "red-0", team: "red" });
    await service.start(quiz.id, quiz.hostId, session.id);
    await expect(service.next(quiz.id, quiz.hostId, session.id)).rejects.toMatchObject({ code: "invalid_phase" });
    await service.answer(session.id, a.id, quiz.questions[0].id, quiz.questions[0].options[0].id);
    await service.answer(session.id, c.id, quiz.questions[0].id, quiz.questions[0].options[0].id);
    const reveal = await service.reveal(quiz.id, quiz.hostId, session.id);
    expect(reveal.correctIndex).toBe(0);
    const board = await service.leaderboard(session.id);
    expect(board.teams).toEqual([{ team: "red", score: 1500, members: 1 }, { team: "blue", score: 750, members: 2 }]);
  });
});
