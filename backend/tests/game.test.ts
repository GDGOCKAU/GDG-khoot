import { describe, expect, it } from "vitest";
import { GameService, MemoryGameRepository, scoreAnswer, type EventAudience } from "../src/game.js";
import type { Quiz } from "../src/domain.js";

const HOST = "admin-1";
const ids = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const mc = (n: number, order: number, extra: Partial<Quiz["questions"][number]> = {}) => ({
  id: ids(n), quizId: ids(1), text: `Question ${order + 1}?`, order, timeLimitSecs: 10, type: "mc", points: 1,
  options: [
    { id: `${ids(n).slice(0, -2)}a1`, text: "Right", isCorrect: true },
    { id: `${ids(n).slice(0, -2)}b2`, text: "Wrong 1", isCorrect: false },
    { id: `${ids(n).slice(0, -2)}c3`, text: "Wrong 2", isCorrect: false },
    { id: `${ids(n).slice(0, -2)}d4`, text: "Wrong 3", isCorrect: false },
  ],
  ...extra,
});
const quiz: Quiz = {
  id: ids(1), title: "Game", hostId: HOST, isPublished: true,
  questions: [
    mc(2, 0),
    { id: ids(3), quizId: ids(1), text: "Dart is compiled", order: 1, timeLimitSecs: 10, type: "tf", points: 2,
      options: [{ id: `${ids(3).slice(0, -2)}t1`, text: "True", isCorrect: true }, { id: `${ids(3).slice(0, -2)}f2`, text: "False", isCorrect: false }] },
    { id: ids(4), quizId: ids(1), text: "Put the pictures together", order: 2, timeLimitSecs: 10, type: "pic", pictureUrls: ["/uploads/a.png", "/uploads/b.png"], word: "DOORMAN",
      options: [{ id: `${ids(4).slice(0, -2)}r1`, text: "DOORMAN", isCorrect: true }, { id: `${ids(4).slice(0, -2)}w2`, text: "NOT_DOORMAN", isCorrect: false }] },
    // incomplete: skipped when the game starts
    { id: ids(5), quizId: ids(1), text: "", order: 3, timeLimitSecs: 10, type: "mc", options: [] },
  ],
};
const FAST = { ready: 5, reveal: 5, leaderboard: 5, next: 5, teams: 5, podium: 5, earlyClose: 5 };

type Ev = { event: string; payload: any; audience?: EventAudience };
function setup(timings: Partial<typeof FAST> = FAST, gameRepository = new MemoryGameRepository()) {
  const events: Ev[] = [];
  const quizRepository = { getQuiz: async (id: string, hostId: string) => (id === quiz.id && hostId === HOST ? quiz : null) };
  const service = new GameService(quizRepository, gameRepository, (_s, event, payload, audience) => events.push({ event, payload, audience }), undefined, timings);
  return { service, events, gameRepository };
}
async function until(events: Ev[], test: (e: Ev) => boolean, ms = 2000) {
  const end = Date.now() + ms;
  for (;;) {
    const hit = events.find(test);
    if (hit) return hit;
    if (Date.now() > end) throw new Error("timed out waiting for event");
    await new Promise((r) => setTimeout(r, 2));
  }
}
const phase = (name: string, index?: number) => (e: Ev) => e.event === "phase" && e.payload.phase === name && (index === undefined || e.payload.index === index);
const question = (index: number) => (e: Ev) => e.event === "question" && e.payload.order === index;

describe("scoring (handoff formula)", () => {
  const T = 20_000;
  it("gives 1000 for an instant answer down to 500 at the limit, times the question's points", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 1, streak: 1 }).points).toBe(1000);
    expect(scoreAnswer({ correct: true, elapsedMs: T, limitMs: T, points: 1, streak: 1 }).points).toBe(500);
    expect(scoreAnswer({ correct: true, elapsedMs: T * 3, limitMs: T, points: 1, streak: 1 }).points).toBe(500);
    expect(scoreAnswer({ correct: true, elapsedMs: T / 2, limitMs: T, points: 1, streak: 1 }).points).toBe(750);
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 2, streak: 1 }).points).toBe(2000);
  });
  it("adds a streak bonus from the 2nd correct in a row, capped at +500", () => {
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 1, streak: 2 }).points).toBe(1100);
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 1, streak: 6 }).points).toBe(1500);
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 1, streak: 20 }).points).toBe(1500);
  });
  it("gives nothing for wrong answers, and nothing at all (not even streak) when points is 0", () => {
    expect(scoreAnswer({ correct: false, elapsedMs: 0, limitMs: T, points: 1, streak: 0 }).points).toBe(0);
    expect(scoreAnswer({ correct: true, elapsedMs: 0, limitMs: T, points: 0, streak: 5 }).points).toBe(0);
  });
});

describe("server-owned game flow", () => {
  it("runs ready -> question -> reveal -> leaderboard -> next ... -> teams -> podium -> final", async () => {
    const { service, events } = setup();
    const session = await service.createSession(quiz.id, HOST);
    const a = await service.joinByPin(session.pin, { name: "Noura", mascot: "blue-0", team: "blue" });
    const b = await service.joinByPin(session.pin, { name: "Ali", mascot: "red-0", team: "red" });
    await service.start(HOST, session.id);
    expect(events.find(phase("ready"))?.payload.upcoming).toEqual({ index: 0, type: "mc", points: 1 });

    const q1 = (await until(events, question(0))).payload;
    expect(q1.questionCount).toBe(3); // the incomplete 4th question is skipped
    expect(JSON.stringify(q1)).not.toMatch(/isCorrect|"word"/);
    await service.answer(session.id, a.id, q1.questionId, { optionId: q1.options[0].id });
    await service.answer(session.id, b.id, q1.questionId, { optionId: q1.options[1].id });
    // everyone answered -> closes early -> reveal
    const reveal = (await until(events, (e) => e.event === "reveal")).payload;
    expect(reveal.correctIndex).toBe(0);
    expect(reveal.counts).toEqual([1, 1, 0, 0]);
    expect(events.find((e) => e.event === "reveal")!.audience ?? "all").toBe("all");
    expect(events.find((e) => e.event === "reveal_host")!.audience).toBe("host");
    const results = events.filter((e) => e.event === "result");
    expect(results.map((e) => e.audience)).toEqual(expect.arrayContaining([{ participantId: a.id }, { participantId: b.id }]));
    const mine = results.find((e) => (e.audience as { participantId: string }).participantId === a.id)!.payload;
    expect(mine).toMatchObject({ correct: true, rank: 1, streak: 1 });
    expect(mine.points).toBeGreaterThanOrEqual(900);

    await until(events, phase("leaderboard", 0));
    expect(events.find((e) => e.event === "leaderboard")?.audience ?? "host").toBe("host");
    await until(events, phase("next", 0));
    const q2 = (await until(events, question(1))).payload;
    expect(q2.points).toBe(2);
    await service.answer(session.id, a.id, q2.questionId, { optionId: q2.options[0].id });
    await service.skip(HOST, session.id); // host Skip closes the question now
    await until(events, (e) => e.event === "reveal" && e.payload.index === 1);
    const q3 = (await until(events, question(2), 3000)).payload;
    expect(q3.options).toEqual([]);
    expect(q3.wordLength).toBe(7);
    await service.answer(session.id, a.id, q3.questionId, { text: "door man" });
    await service.answer(session.id, b.id, q3.questionId, { text: "DOORMEN" });
    const picReveal = (await until(events, (e) => e.event === "reveal" && e.payload.index === 2)).payload;
    expect(picReveal).toMatchObject({ word: "DOORMAN", counts: { right: 1, wrong: 1, none: 0 } });

    const final = (await until(events, (e) => e.event === "final", 3000)).payload;
    expect(final.top3.map((p: { name: string }) => p.name)).toEqual(["Noura", "Ali"]);
    expect(final.ranking).toHaveLength(2);
    expect(final.teams.map((t: { team: string }) => t.team)).toEqual(["blue", "red"]);
    await until(events, phase("teams"));
    await until(events, phase("podium"));
    const last = (await until(events, phase("final"))).payload;
    expect(last.endsAt).toBeNull();
    // Noura: q1 right, q2 right (double points, streak 2), q3 right (streak 3)
    const noura = final.ranking[0];
    expect(noura).toMatchObject({ correct: 3, streak: 3 });
    expect(noura.score).toBeGreaterThan(1000 + 2000 + 100);
    await expect(service.lookupByPin(session.pin)).rejects.toMatchObject({ code: "game_closed" });
  });

  it("refuses late joins, Start without players, and locked rooms", async () => {
    const { service } = setup();
    const session = await service.createSession(quiz.id, HOST);
    await expect(service.start(HOST, session.id)).rejects.toMatchObject({ code: "no_players" });
    await service.settings(HOST, session.id, { locked: true });
    await expect(service.lookupByPin(session.pin)).rejects.toMatchObject({ code: "game_locked" });
    await expect(service.joinByPin(session.pin, { name: "X", mascot: "blue-0", team: "blue" })).rejects.toMatchObject({ code: "game_locked" });
    await service.settings(HOST, session.id, { locked: false });
    await service.joinByPin(session.pin, { name: "X", mascot: "blue-0", team: "blue" });
    await expect(service.joinByPin(session.pin, { name: "x", mascot: "red-0", team: "red" })).rejects.toMatchObject({ code: "duplicate_participant" });
    await service.start(HOST, session.id);
    await expect(service.joinByPin(session.pin, { name: "Late", mascot: "red-0", team: "red" })).rejects.toMatchObject({ code: "invalid_phase" });
    await expect(service.lookupByPin(session.pin)).rejects.toMatchObject({ code: "game_started" });
  });

  it("rejects answers outside the open question and a second answer", async () => {
    const { service, events } = setup({ ...FAST, ready: 50 });
    const session = await service.createSession(quiz.id, HOST);
    const a = await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.joinByPin(session.pin, { name: "B", mascot: "red-0", team: "red" });
    await service.start(HOST, session.id);
    await expect(service.answer(session.id, a.id, quiz.questions[0].id, { optionId: quiz.questions[0].options[0].id })).rejects.toMatchObject({ code: "invalid_phase" });
    const q1 = (await until(events, question(0))).payload;
    await service.answer(session.id, a.id, q1.questionId, { optionId: q1.options[0].id });
    await expect(service.answer(session.id, a.id, q1.questionId, { optionId: q1.options[1].id })).rejects.toMatchObject({ code: "answer_already_submitted" });
  });

  it("tells players the game was closed when the host ends it", async () => {
    const { service, events } = setup();
    const session = await service.createSession(quiz.id, HOST);
    await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.cancel(HOST, session.id);
    expect(events.find((e) => e.event === "closed")).toMatchObject({ audience: undefined, payload: { reason: "host_ended" } });
    await expect(service.lookupByPin(session.pin)).rejects.toMatchObject({ code: "game_closed" });
  });

  it("rebuilds the running phase after a server restart", async () => {
    const repo = new MemoryGameRepository();
    const first = setup({ ...FAST, earlyClose: 10_000 }, repo);
    const session = await first.service.createSession(quiz.id, HOST);
    const a = await first.service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await first.service.start(HOST, session.id);
    await until(first.events, question(0));
    const restarted = setup(FAST, repo);
    const state = await restarted.service.participantState(session.id, a.id);
    expect(state.phase.phase).toBe("question");
    expect(state.question?.questionId).toBe(quiz.questions[0].id);
    await first.service.cancel(HOST, session.id);
  });

  it("counts finished games for the dashboard (games, players, accuracy, lastHosted)", async () => {
    const { service, events } = setup();
    const session = await service.createSession(quiz.id, HOST);
    const a = await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.start(HOST, session.id);
    for (let i = 0; i < 3; i++) {
      const q = (await until(events, question(i), 3000)).payload;
      await service.answer(session.id, a.id, q.questionId, q.options.length ? { optionId: q.options[0].id } : { text: "DOORMAN" });
    }
    await until(events, (e) => e.event === "final", 3000);
    const stats = await service.stats(HOST);
    expect(stats).toMatchObject({ gamesHosted: 1, players: 1, accuracy: 1 });
    expect(Object.keys(stats.lastHosted)).toEqual([quiz.id]);
  });
});

describe("host reveal: counts and why the question closed", () => {
  const revealHost = (index: number) => (e: Ev) => e.event === "reveal_host" && e.payload.index === index;
  it("one right, one wrong on MC, True/False and Picture: counts, choices and 'all_answered'", async () => {
    const { service, events } = setup();
    const session = await service.createSession(quiz.id, HOST);
    const right = await service.joinByPin(session.pin, { name: "Right", mascot: "blue-0", team: "blue" });
    const wrong = await service.joinByPin(session.pin, { name: "Wrong", mascot: "red-0", team: "red" });
    await service.start(HOST, session.id);
    const expected = [
      { counts: [1, 1, 0, 0], choices: { [right.id]: 0, [wrong.id]: 1 } },
      { counts: [1, 1], choices: { [right.id]: 0, [wrong.id]: 1 } },
      { counts: { right: 1, wrong: 1, none: 0 }, choices: { [right.id]: true, [wrong.id]: false } },
    ];
    for (let i = 0; i < 3; i++) {
      const q = (await until(events, question(i), 3000)).payload;
      if (q.type === "pic") {
        await service.answer(session.id, right.id, q.questionId, { text: "doorman" });
        await service.answer(session.id, wrong.id, q.questionId, { text: "doormen" });
      } else {
        await service.answer(session.id, right.id, q.questionId, { optionId: q.options[0].id });
        await service.answer(session.id, wrong.id, q.questionId, { optionId: q.options[1].id });
      }
      const host = (await until(events, revealHost(i))).payload;
      expect(host.closedBy).toBe("all_answered");
      expect(host.counts).toEqual(expected[i].counts);
      expect(host.choices).toEqual(expected[i].choices);
      expect(host.total).toBe(2);
      // the right player is credited, the wrong one is not
      expect(host.standings.find((p: { id: string }) => p.id === right.id).lastOk).toBe(true);
      expect(host.standings.find((p: { id: string }) => p.id === wrong.id).lastOk).toBe(false);
      // phones see the same reason (no host-only data)
      expect(events.find((e) => e.event === "reveal" && e.payload.index === i)!.payload.closedBy).toBe("all_answered");
    }
    await until(events, (e) => e.event === "final", 3000);
  });

  it("says 'skip' when the host skips and 'time' when the timer runs out", async () => {
    // a 0.3 s question so the timer really runs out
    const short: Quiz = { ...quiz, questions: [mc(2, 0, { timeLimitSecs: 0.3 }), mc(6, 1)] };
    const events: Ev[] = [];
    const service = new GameService({ getQuiz: async () => short }, new MemoryGameRepository(), (_s, event, payload, audience) => events.push({ event, payload, audience }), undefined, FAST);
    const session = await service.createSession(short.id, HOST);
    const a = await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.joinByPin(session.pin, { name: "B", mascot: "red-0", team: "red" });
    await service.start(HOST, session.id);
    const q1 = (await until(events, question(0))).payload;
    await service.answer(session.id, a.id, q1.questionId, { optionId: q1.options[0].id });
    const timeUp = (await until(events, revealHost(0), 3000)).payload;
    expect(timeUp.closedBy).toBe("time");
    expect(timeUp.counts).toEqual([1, 0, 0, 0]);

    await until(events, question(1), 3000);
    await service.skip(HOST, session.id);
    expect((await until(events, revealHost(1))).payload.closedBy).toBe("skip");
  });
});

describe("power-ups", () => {
  async function inQuestion(powerUps: boolean, index = 0) {
    const ctx = setup({ ...FAST, earlyClose: 10_000 });
    const session = await ctx.service.createSession(quiz.id, HOST, { powerUps });
    const a = await ctx.service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    const b = await ctx.service.joinByPin(session.pin, { name: "B", mascot: "red-0", team: "red" });
    await ctx.service.start(HOST, session.id);
    let q = (await until(ctx.events, question(0))).payload;
    for (let i = 0; i < index; i++) {
      await ctx.service.skip(HOST, session.id);
      await until(ctx.events, (e) => e.event === "reveal" && e.payload.index === i);
      q = (await until(ctx.events, question(i + 1), 3000)).payload;
    }
    return { ...ctx, session, a, b, q };
  }

  it("are off by default", async () => {
    const { service, session, a } = await inQuestion(false);
    await expect(service.usePowerUp(session.id, a.id, "double")).rejects.toMatchObject({ code: "power_ups_off" });
    await service.cancel(HOST, session.id);
  });

  it("Double Points doubles a correct answer, once per player", async () => {
    const { service, session, a, b, q, events } = await inQuestion(true);
    await service.usePowerUp(session.id, a.id, "double");
    const doubled = await service.answer(session.id, a.id, q.questionId, { optionId: q.options[0].id });
    const plain = await service.answer(session.id, b.id, q.questionId, { optionId: q.options[0].id });
    expect(doubled.doubled).toBe(true);
    expect(doubled.points).toBeGreaterThan(1.8 * plain.points);
    await service.skip(HOST, session.id);
    const result = (await until(events, (e) => e.event === "result" && (e.audience as { participantId: string }).participantId === a.id)).payload;
    expect(result.doubled).toBe(true);
    await until(events, question(1), 3000);
    await expect(service.usePowerUp(session.id, a.id, "double")).rejects.toMatchObject({ code: "power_up_used" });
    await service.cancel(HOST, session.id);
  });

  it("50/50 removes two wrong options chosen by the server, MC only, before answering", async () => {
    const { service, session, a, b, q, events } = await inQuestion(true);
    const used = await service.usePowerUp(session.id, a.id, "fifty");
    expect(used.removedOptionIds).toHaveLength(2);
    const correctId = quiz.questions[0].options[0].id;
    expect(used.removedOptionIds).not.toContain(correctId);
    await expect(service.usePowerUp(session.id, a.id, "fifty")).rejects.toMatchObject({ code: "power_up_used" });
    const state = await service.participantState(session.id, a.id);
    expect(state.powerUps).toMatchObject({ enabled: true, fiftyUsed: true, removedOptionIds: used.removedOptionIds });
    await service.answer(session.id, b.id, q.questionId, { optionId: q.options[0].id });
    await expect(service.usePowerUp(session.id, b.id, "fifty")).rejects.toMatchObject({ code: "answer_already_submitted" });
    // next question is true/false: 50/50 is not allowed there
    await service.skip(HOST, session.id);
    await until(events, (e) => e.event === "reveal" && e.payload.index === 0);
    await until(events, question(1), 3000);
    await expect(service.usePowerUp(session.id, b.id, "fifty")).rejects.toMatchObject({ code: "power_up_not_allowed" });
    await service.cancel(HOST, session.id);
  });

  it("can be switched on in the lobby only", async () => {
    const { service } = setup();
    const session = await service.createSession(quiz.id, HOST);
    await expect(service.settings(HOST, session.id, { powerUps: true })).resolves.toMatchObject({ powerUps: true });
    await service.joinByPin(session.pin, { name: "A", mascot: "blue-0", team: "blue" });
    await service.start(HOST, session.id);
    await expect(service.settings(HOST, session.id, { powerUps: false })).rejects.toMatchObject({ code: "invalid_phase" });
    await service.cancel(HOST, session.id);
  });
});
