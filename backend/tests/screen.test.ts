/* The audience screen is read-only: it follows the newest open session, sees what players see
   (plus names and scores) and never gets host rights or a single player's private result. */
import bcrypt from "bcryptjs";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import type { Server } from "socket.io";
import { buildApp } from "../src/app.js";
import { GameService, MemoryGameRepository } from "../src/game.js";
import { attachRealtime, roomEmitter } from "../src/realtime.js";
import { MemoryRepository } from "../src/repository/memory.js";

const QUIZ_ID = "11111111-1111-4111-8111-111111111111";
const Q1 = "22222222-2222-4222-8222-222222222222";
const RIGHT = "33333333-3333-4333-8333-333333333333";

async function setup() {
  const repository = new MemoryRepository();
  repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
  repository.quizzes.push({
    id: QUIZ_ID, title: "Screen quiz", hostId: "admin-1", isPublished: true,
    questions: [{
      id: Q1, quizId: QUIZ_ID, text: "Big screen question", order: 0, timeLimitSecs: 20,
      options: [
        { id: RIGHT, text: "Right", isCorrect: true },
        { id: "44444444-4444-4444-8444-444444444444", text: "Wrong", isCorrect: false },
      ],
    }],
  });
  const gameService = new GameService(repository, new MemoryGameRepository(), undefined, undefined, { ready: 20, reveal: 2000, earlyClose: 20 });
  const app = buildApp(repository, "test-secret-that-is-long", gameService);
  await app.ready();
  const io: Server = attachRealtime(app.server, { gameService, verifyHostToken: (t) => app.verifyAdminToken(t) });
  gameService.setEmitter(roomEmitter(io));
  await app.listen({ port: 0, host: "127.0.0.1" });
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token as string;
  return { app, io, url, auth: { authorization: `Bearer ${token}` } };
}

const sockets: Socket[] = [];
const closers: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  for (const close of closers.splice(0)) await close();
});
const open = (url: string) => { const s = connect(url, { transports: ["websocket"], forceNew: true }); sockets.push(s); return s; };
const watch = (socket: Socket) => new Promise<{ ok: boolean; state: Record<string, any> | null }>((resolve) => socket.emit("screen:watch", resolve));
type Seen = { sessionId: string; event: string; payload: any };
const collect = (socket: Socket) => { const seen: Seen[] = []; socket.on("screen:event", (e: Seen) => seen.push(e)); return seen; };
const until = async (fn: () => boolean, ms = 3000) => { const end = Date.now() + ms; while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 25)); expect(fn()).toBe(true); };

describe("audience screen", () => {
  it("is idle with no session, then follows the newest session through a whole question", async () => {
    const { app, io, url, auth } = await setup();
    closers.push(async () => { io.close(); await app.close(); });

    const screen = open(url);
    const idle = await watch(screen);
    expect(idle).toEqual({ ok: true, state: null });
    const seen = collect(screen);

    const session = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();
    await until(() => seen.some((e) => e.event === "session_started" && e.sessionId === session.id));

    // lobby: PIN and title are there, the question is not
    const lobby = (await watch(open(url))).state!;
    expect(lobby.pin).toBe(session.pin);
    expect(lobby.quizTitle).toBe("Screen quiz");
    expect(lobby.phase.phase).toBe("lobby");
    expect(lobby.question).toBeNull();
    expect(JSON.stringify(lobby)).not.toContain("Big screen question");

    const player = (await app.inject({ method: "POST", url: "/api/v1/sessions/join", payload: { pin: session.pin, name: "Noura", mascot: "blue-0", team: "blue" } })).json();
    await until(() => seen.some((e) => e.event === "player_joined" && e.payload.participant.name === "Noura"));

    await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/start`, headers: auth, payload: {} });
    await until(() => seen.some((e) => e.event === "question"));
    const question = seen.find((e) => e.event === "question")!.payload;
    expect(question.text).toBe("Big screen question");
    expect(JSON.stringify(question)).not.toMatch(/isCorrect|"correct"/);

    await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/answers`, payload: { participantId: player.id, questionId: Q1, optionId: RIGHT } });
    await until(() => seen.some((e) => e.event === "reveal_host"));
    const names = seen.map((e) => e.event);
    expect(names).toContain("answer_count");
    expect(names).toContain("reveal");
    // who picked what stays private, and so does a player's own result
    expect(JSON.stringify(seen.find((e) => e.event === "reveal_host")!.payload)).not.toContain("choices");
    expect(names).not.toContain("result");

    // a screen that opens mid-reveal catches up from the snapshot
    const late = (await watch(open(url))).state!;
    expect(late.phase.phase).toBe("reveal");
    // a one-question quiz keeps the ranking secret until the end screens: names only, no scores or standings
    expect(late.phase.rankHidden).toBe(true);
    expect(late.standings[0]).toEqual({ id: player.id, name: "Noura", team: "blue", mascot: "blue-0" });
    expect(late.hostReveal.choices).toBeUndefined();
    expect(late.hostReveal.standings).toBeUndefined();
  });

  it("switches to the next session and goes idle when the host closes it", async () => {
    const { app, io, url, auth } = await setup();
    closers.push(async () => { io.close(); await app.close(); });
    const screen = open(url);
    await watch(screen);
    const seen = collect(screen);

    const first = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();
    const second = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();
    await until(() => seen.some((e) => e.event === "session_started" && e.sessionId === second.id));
    expect((await watch(open(url))).state!.sessionId).toBe(second.id);

    await app.inject({ method: "POST", url: `/api/v1/sessions/${second.id}/cancel`, headers: auth });
    await until(() => seen.some((e) => e.event === "closed" && e.sessionId === second.id));
    expect((await watch(open(url))).state).toBeNull();
    expect(first.id).not.toBe(second.id);
  });
});
