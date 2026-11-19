import bcrypt from "bcryptjs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRepository } from "../src/repository/memory.js";
import { GameService, MemoryGameRepository } from "../src/game.js";

describe("backend API foundation", () => {
  const repositories: MemoryRepository[] = [];
  afterEach(() => repositories.pop());

  function setup() {
    const repository = new MemoryRepository();
    repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
    repositories.push(repository);
    const gameRepository = new MemoryGameRepository();
    const gameService = new GameService(repository, gameRepository);
    return { app: buildApp(repository, "test-secret-that-is-long", gameService), repository };
  }

  it("reports health", async () => {
    const { app } = setup();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("authenticates an admin and protects quiz routes", async () => {
    const { app } = setup();
    const unauthorized = await app.inject({ method: "GET", url: "/api/v1/quizzes" });
    expect(unauthorized.statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: "secret" },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().token;
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/quizzes",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Architecture checkpoint" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().title).toBe("Architecture checkpoint");
    await app.close();
  });

  it("creates questions and rejects duplicate order values", async () => {
    const { app } = setup();
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } });
    const token = login.json().token;
    const quiz = await app.inject({
      method: "POST",
      url: "/api/v1/quizzes",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Quiz" },
    });
    const url = `/api/v1/quizzes/${quiz.json().id}/questions`;
    const payload = { text: "Question", order: 0, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] };
    expect((await app.inject({ method: "POST", url, headers: { authorization: `Bearer ${token}` }, payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url, headers: { authorization: `Bearer ${token}` }, payload })).statusCode).toBe(409);
    await app.close();
  });

  it("saves drafts, publishes atomically, and rejects invalid publish data", async () => {
    const { app } = setup();
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } });
    const token = login.json().token;
    const headers = { authorization: `Bearer ${token}` };

    const draft = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save", headers,
      payload: { title: "Draft quiz", description: "Editable", isPublished: false, questions: [{ text: "", order: 0, timeLimitSecs: 20, options: [] }] },
    });
    expect(draft.statusCode).toBe(201);
    expect(draft.json().isPublished).toBe(false);

    const invalid = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save", headers,
      payload: {
        quizId: draft.json().id,
        title: "Invalid publish",
        isPublished: true,
        questions: [{ text: "Question", order: 0, timeLimitSecs: 20, options: [
          { text: "A", isCorrect: false }, { text: "B", isCorrect: false },
        ] }],
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error).toBe("invalid_publish_quiz");

    const published = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save", headers,
      payload: {
        quizId: draft.json().id,
        title: "Published quiz",
        isPublished: true,
        questions: [{ text: "Question", order: 0, timeLimitSecs: 20, options: [
          { text: "A", isCorrect: true }, { text: "B", isCorrect: false },
        ] }],
      },
    });
    expect(published.statusCode).toBe(200);
    expect(published.json().isPublished).toBe(true);
    expect(published.json().questions).toHaveLength(1);

    const republish = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save", headers,
      payload: {
        quizId: draft.json().id,
        title: "Updated published quiz",
        isPublished: true,
        questions: [{ text: "Updated question", order: 0, timeLimitSecs: 10, options: [
          { text: "Yes", isCorrect: true }, { text: "No", isCorrect: false },
        ] }],
      },
    });
    expect(republish.statusCode).toBe(200);
    expect(republish.json().title).toBe("Updated published quiz");
    expect(republish.json().questions[0].text).toBe("Updated question");
    await app.close();
  });

  it("requires authorization for atomic quiz save", async () => {
    const { app } = setup();
    const response = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save",
      payload: { title: "Unauthorized", isPublished: false, questions: [] },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns 404 for an unknown PIN and 409 for duplicate nickname", async () => {
    const { app } = setup();
    const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } });
    const token = login.json().token;
    const unknown = await app.inject({ method: "GET", url: "/api/v1/sessions/by-pin/123456" });
    expect(unknown.statusCode).toBe(404);

    const quiz = await app.inject({
      method: "POST", url: "/api/v1/quizzes/save",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Live duplicate test", isPublished: true, questions: [{
        text: "Question", order: 0, timeLimitSecs: 20,
        options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }],
      }] },
    });
    expect(quiz.statusCode).toBe(201);
    const session = await app.inject({
      method: "POST", url: "/api/v1/sessions",
      headers: { authorization: `Bearer ${token}` },
      payload: { quizId: quiz.json().id },
    });
    expect(session.statusCode).toBe(201);
    const pinLookup = await app.inject({
      method: "GET", url: `/api/v1/sessions/by-pin/${session.json().pin}`,
    });
    expect(pinLookup.statusCode).toBe(200);
    // Lobby gate: PIN lookup exposes only metadata; questions arrive via the socket after start.
    expect(pinLookup.json().quiz.questions).toBeUndefined();
    expect(pinLookup.json().quiz.questionCount).toBe(1);
    expect(JSON.stringify(pinLookup.json())).not.toContain('"isCorrect"');
    expect(JSON.stringify(pinLookup.json())).not.toContain('"options"');
    await app.close();
  });

  it("stores uploaded pictures as files and refuses base64 picture URLs in quizzes", async () => {
    const repository = new MemoryRepository();
    repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), "kauhoot-uploads-"));
    const app = buildApp(repository, "test-secret-that-is-long", new GameService(repository, new MemoryGameRepository()), { uploadDir });
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const auth = { authorization: `Bearer ${token}` };
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    expect((await app.inject({ method: "POST", url: "/api/v1/uploads", payload: { dataUrl: png } })).statusCode).toBe(401);
    const upload = await app.inject({ method: "POST", url: "/api/v1/uploads", headers: auth, payload: { dataUrl: png } });
    expect(upload.statusCode).toBe(201);
    const url = upload.json().url as string;
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    const served = await app.inject({ method: "GET", url });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect((await app.inject({ method: "GET", url: "/uploads/..%2Fsecret.png" })).statusCode).toBe(404);
    const question = (pictureUrls: string[]) => ({ text: "Pics", order: 0, timeLimitSecs: 20, type: "pic", pictureUrls, word: "DOORMAN",
      options: [{ text: "DOORMAN", isCorrect: true }, { text: "NOT_DOORMAN", isCorrect: false }] });
    const base64 = await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "P", isPublished: true, questions: [question([png, png])] } });
    expect(base64.statusCode).toBe(400);
    const saved = await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "P", isPublished: true, questions: [question([url, url])] } });
    expect(saved.statusCode).toBe(201);
    await app.close();
  });

  it("validates quizzes like the editor: limits on every save, completeness on publish", async () => {
    const { app } = setup();
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const save = (payload: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: { authorization: `Bearer ${token}` }, payload });
    const q = (extra: Record<string, unknown>) => ({ text: "Question", order: 0, timeLimitSecs: 20, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }], ...extra });
    // limits
    expect((await save({ title: "x".repeat(61), isPublished: false, questions: [q({})] })).statusCode).toBe(400);
    expect((await save({ title: "T", description: "d".repeat(91), isPublished: false, questions: [q({})] })).statusCode).toBe(400);
    expect((await save({ title: "T", isPublished: false, questions: [q({ text: "t".repeat(161) })] })).statusCode).toBe(400);
    expect((await save({ title: "T", isPublished: false, questions: [q({ timeLimitSecs: 25 })] })).statusCode).toBe(400);
    expect((await save({ title: "T", isPublished: false, questions: [q({ points: 3 })] })).statusCode).toBe(400);
    expect((await save({ title: "T", isPublished: false, questions: [q({ type: "pic", word: "NO-DASH" })] })).statusCode).toBe(400);
    // drafts may be incomplete, publishing may not
    const half = { title: "T", isPublished: false, questions: [q({ type: "code", code: "" })] };
    expect((await save(half)).statusCode).toBe(201);
    const refused = await save({ ...half, isPublished: true });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ error: "invalid_publish_quiz", problems: [{ index: 0, problem: "needs code" }] });
    expect((await save({ title: "T", isPublished: true, questions: [q({ type: "pic", pictureUrls: ["/uploads/a.png"], word: "DOOR" })] })).json().problems[0].problem).toBe("needs 2 pictures");
    expect((await save({ title: "T", isPublished: true, questions: [q({ options: [{ text: "A", isCorrect: true }] })] })).json().problems[0].problem).toBe("needs 2 answers");
    // the server owns picture options (from the word) and keeps points / image / topic
    const ok = await save({ title: "T", topic: "Cloud", isPublished: true, questions: [
      q({ type: "pic", pictureUrls: ["/uploads/a.png", "/uploads/b.png"], word: "door man", options: [] }),
      q({ order: 1, points: 2, imageUrl: "/uploads/c.png" }),
      q({ order: 2, points: 0, options: [{ text: "A", isCorrect: true }, { text: "", isCorrect: false }, { text: "C", isCorrect: false }, { text: "", isCorrect: false }] }),
    ] });
    expect(ok.statusCode).toBe(201);
    const saved = ok.json();
    expect(saved.topic).toBe("Cloud");
    expect(saved.questions[0]).toMatchObject({ word: "DOORMAN", options: [{ text: "DOORMAN", isCorrect: true }, { text: "NOT_DOORMAN", isCorrect: false }] });
    expect(saved.questions[1]).toMatchObject({ points: 2, imageUrl: "/uploads/c.png" });
    expect(saved.questions[2].options.map((o: { text: string }) => o.text)).toEqual(["A", "C"]);
    expect(saved.questions[2].points).toBe(0);
  });
});
