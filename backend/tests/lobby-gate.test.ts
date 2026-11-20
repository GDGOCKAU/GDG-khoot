/* The lobby gate is enforced by the server: a joined player gets no question data,
   over HTTP or over the socket, until the host calls /start. */
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

async function setup() {
  const repository = new MemoryRepository();
  repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
  repository.quizzes.push({
    id: QUIZ_ID, title: "Gate", hostId: "admin-1", isPublished: true,
    questions: [{
      id: Q1, quizId: QUIZ_ID, text: "Secret question text", order: 0, timeLimitSecs: 20,
      options: [
        { id: "33333333-3333-4333-8333-333333333333", text: "Right", isCorrect: true },
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
  const auth = { authorization: `Bearer ${token}` };
  return { app, io, url, token, auth };
}

const sockets: Socket[] = [];
const closers: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  for (const close of closers.splice(0)) await close();
});

function open(url: string) {
  const socket = connect(url, { transports: ["websocket"], forceNew: true });
  sockets.push(socket);
  return socket;
}
const emitAck = <T>(socket: Socket, ...args: unknown[]) =>
  new Promise<T>((resolve) => socket.emit(args[0] as string, ...args.slice(1), (r: T) => resolve(r)));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("lobby gate (server enforced)", () => {
  it("keeps a joined player in LOBBY with no question until the host starts", async () => {
    const { app, io, url, token, auth } = await setup();
    closers.push(async () => { io.close(); await app.close(); });

    const session = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();

    // 1. PIN lookup in LOBBY carries no question content at all.
    const lookup = await app.inject({ method: "GET", url: `/api/v1/sessions/by-pin/${session.pin}` });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().quiz.questions).toBeUndefined();
    expect(lookup.json().quiz.questionCount).toBe(1);
    expect(lookup.body).not.toContain("Secret question text");
    expect(lookup.body).not.toContain("Right");

    const participant = (await app.inject({ method: "POST", url: "/api/v1/sessions/join", payload: { pin: session.pin, name: "Noura", mascot: "blue-0", team: "blue" } })).json();

    // 2. Player socket joins; server says LOBBY and hands over no question.
    const player = open(url);
    const received: Array<{ event: string; payload: unknown }> = [];
    player.onAny((event, payload) => received.push({ event, payload }));
    const joined = await emitAck<{ ok: boolean; state: { status: string; question: unknown } }>(player, "game:join", session.id, participant.id);
    expect(joined.ok).toBe(true);
    expect(joined.state.status).toBe("LOBBY");
    expect(joined.state.question).toBeNull();

    // 3. Answers are refused while in LOBBY.
    const early = await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/answers`, payload: { participantId: participant.id, questionId: Q1, optionId: "33333333-3333-4333-8333-333333333333" } });
    expect(early.statusCode).toBe(400);
    expect(early.json().error).toBe("invalid_phase");

    // 4. Nothing reaches the player while the host has not pressed Start.
    await wait(300);
    expect(received.map((r) => r.event)).not.toContain("question");
    expect(JSON.stringify(received)).not.toContain("Secret question text");

    // 5. Host joins its own authenticated room and starts the game.
    const host = open(url);
    const hostJoined = await emitAck<{ ok: boolean }>(host, "host:join", session.id, token);
    expect(hostJoined.ok).toBe(true);
    const gotQuestion = new Promise<Record<string, unknown>>((resolve) => player.once("question", resolve));
    const start = await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/start`, headers: auth, payload: { quizId: QUIZ_ID } });
    expect(start.statusCode).toBe(200);

    // 6. Only now the question arrives, in its public shape (no correctness).
    const question = await gotQuestion;
    expect(question.text).toBe("Secret question text");
    expect(question.questionId).toBe(Q1);
    expect(JSON.stringify(question)).not.toMatch(/isCorrect|"correct"|"word"/);
  });

  it("rejects sockets that are not a participant of the session, and a host without a valid token", async () => {
    const { app, io, url, auth } = await setup();
    closers.push(async () => { io.close(); await app.close(); });
    const session = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();

    const stranger = open(url);
    const asPlayer = await emitAck<{ ok: boolean; error: string }>(stranger, "game:join", session.id, "55555555-5555-4555-8555-555555555555");
    expect(asPlayer).toEqual({ ok: false, error: "participant_not_found" });
    const asHost = await emitAck<{ ok: boolean }>(stranger, "host:join", session.id, "not-a-token");
    expect(asHost.ok).toBe(false);

    const received: string[] = [];
    stranger.onAny((event) => received.push(event));
    await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/start`, headers: auth, payload: { quizId: QUIZ_ID } });
    await wait(200);
    expect(received).not.toContain("question");
  });

  it("does not broadcast answer correctness to other players", async () => {
    const { app, io, url, auth } = await setup();
    closers.push(async () => { io.close(); await app.close(); });
    const session = (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId: QUIZ_ID } })).json();
    const a = (await app.inject({ method: "POST", url: "/api/v1/sessions/join", payload: { pin: session.pin, name: "A", mascot: "red-0", team: "red" } })).json();
    const b = (await app.inject({ method: "POST", url: "/api/v1/sessions/join", payload: { pin: session.pin, name: "B", mascot: "blue-0", team: "blue" } })).json();
    const watcher = open(url);
    await emitAck(watcher, "game:join", session.id, b.id);
    const seen: Array<{ event: string; payload: unknown }> = [];
    watcher.onAny((event, payload) => seen.push({ event, payload }));
    const gotQuestion = new Promise((resolve) => watcher.once("question", resolve));
    await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/start`, headers: auth, payload: {} });
    await gotQuestion;
    const answered = await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/answers`, payload: { participantId: a.id, questionId: Q1, optionId: "33333333-3333-4333-8333-333333333333" } });
    expect(answered.json()).toEqual({ accepted: true, questionId: Q1 });
    await wait(150);
    expect(JSON.stringify(seen)).not.toContain("isCorrect");
    expect(seen.map((s) => s.event)).not.toContain("answer_count");
    // at reveal B gets only B's own result; the host-only reveal never reaches a phone
    await app.inject({ method: "POST", url: `/api/v1/sessions/${session.id}/skip`, headers: auth, payload: {} });
    await wait(200);
    const results = seen.filter((s) => s.event === "result").map((s) => s.payload as { answered: boolean; correct: boolean });
    expect(results).toEqual([expect.objectContaining({ answered: false, correct: false })]);
    expect(seen.map((s) => s.event)).toContain("reveal");
    expect(seen.map((s) => s.event)).not.toContain("reveal_host");
    expect(seen.map((s) => s.event)).not.toContain("leaderboard");
  });
});
