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
  it("deletes a quiz on the server: closes an unstarted lobby, refuses while a game is being played", async () => {
    const { app } = setup();
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const auth = { authorization: `Bearer ${token}` };
    const makeQuiz = async (title: string) => (await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title, isPublished: true, questions: [{
      text: "Question", order: 0, timeLimitSecs: 20, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }],
    }] } })).json().id as string;
    const open = async (quizId: string) => (await app.inject({ method: "POST", url: "/api/v1/sessions", headers: auth, payload: { quizId } })).json();

    // a lobby nobody started is closed with the quiz; no body and no content type, like the browser sends
    const a = await makeQuiz("Delete me");
    const lobby = await open(a);
    const deleted = await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${a}`, headers: auth });
    expect(deleted.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/api/v1/quizzes/${a}`, headers: auth })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/v1/sessions/by-pin/${lobby.pin}` })).statusCode).not.toBe(200);

    // a game in progress blocks the delete until the host ends it
    const b = await makeQuiz("Being played");
    const game = await open(b);
    await app.inject({ method: "POST", url: "/api/v1/sessions/join", payload: { pin: game.pin, name: "Reem", mascot: "blue-0", team: "blue" } });
    expect((await app.inject({ method: "POST", url: `/api/v1/sessions/${game.id}/start`, headers: auth, payload: {} })).statusCode).toBe(200);
    const refused = await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${b}`, headers: auth });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error).toBe("quiz_in_live_game");
    expect((await app.inject({ method: "GET", url: `/api/v1/quizzes/${b}`, headers: auth })).statusCode).toBe(200);
    await app.inject({ method: "POST", url: `/api/v1/sessions/${game.id}/cancel`, headers: auth, payload: {} });
    expect((await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${b}`, headers: auth })).statusCode).toBe(204);

    // someone else's quiz or an unknown id
    expect((await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${a}`, headers: auth })).statusCode).toBe(404);
    await app.close();
  });
  it("lists published quizzes publicly with metadata only", async () => {
    const { app } = setup();
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const auth = { authorization: `Bearer ${token}` };
    expect((await app.inject({ method: "GET", url: "/api/v1/public/quizzes" })).json()).toEqual([]);
    const question = { text: "Secret question?", order: 0, timeLimitSecs: 20, options: [{ text: "Secret answer", isCorrect: true }, { text: "Other", isCorrect: false }] };
    await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "Published", description: "Shown", topic: "Cloud", isPublished: true, questions: [question] } });
    await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "Draft", isPublished: false, questions: [question] } });
    const response = await app.inject({ method: "GET", url: "/api/v1/public/quizzes" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ title: "Published", description: "Shown", topic: "Cloud", questionCount: 1 })]);
    const raw = response.body;
    for (const leak of ["Secret question", "Secret answer", "isCorrect", "options", "questions\"", "hostId"]) expect(raw).not.toContain(leak);
    await app.close();
  });
  it("deleting a quiz removes its uploaded pictures unless another quiz still uses them", async () => {
    const repository = new MemoryRepository();
    repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), "kauhoot-uploads-"));
    const app = buildApp(repository, "test-secret-that-is-long", new GameService(repository, new MemoryGameRepository()), { uploadDir });
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const auth = { authorization: `Bearer ${token}` };
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const upload = async () => (await app.inject({ method: "POST", url: "/api/v1/uploads", headers: auth, payload: { dataUrl: png } })).json().url as string;
    const [shared, own, pic1, pic2] = [await upload(), await upload(), await upload(), await upload()];
    const quiz = (title: string, imageUrl: string, pictureUrls: string[] = []) => ({ title, isPublished: false, questions: [
      { text: "MC", order: 0, timeLimitSecs: 20, type: "mc", imageUrl, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] },
      ...(pictureUrls.length ? [{ text: "Pic", order: 1, timeLimitSecs: 30, type: "pic", word: "AB", pictureUrls, options: [] }] : []),
    ] });
    const a = (await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: quiz("A", own, [pic1, shared]) })).json().id;
    const b = (await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: quiz("B copy", shared, [pic2]) })).json().id;
    const onDisk = async (url: string) => (await app.inject({ method: "GET", url })).statusCode === 200;

    expect((await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${a}`, headers: auth })).statusCode).toBe(204);
    expect(await onDisk(own)).toBe(false);
    expect(await onDisk(pic1)).toBe(false);
    expect(await onDisk(shared)).toBe(true); // quiz B still shows it
    expect(await onDisk(pic2)).toBe(true);

    expect((await app.inject({ method: "DELETE", url: `/api/v1/quizzes/${b}`, headers: auth })).statusCode).toBe(204);
    expect(await onDisk(shared)).toBe(false);
    expect(await onDisk(pic2)).toBe(false);
    await app.close();
  });
  it("says which question breaks a save rule (for the CSV import) and caps a quiz at 100 questions", async () => {
    const { app } = setup();
    const token = (await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "admin@example.com", password: "secret" } })).json().token;
    const auth = { authorization: `Bearer ${token}` };
    const ok = { text: "Fine", order: 0, timeLimitSecs: 20, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] };
    const bad = await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "Import", isPublished: false, questions: [
      ok, { ...ok, order: 1, text: "x".repeat(161) }, { ...ok, order: 2, timeLimitSecs: 45 },
    ] } });
    expect(bad.statusCode).toBe(400);
    const paths = bad.json().issues.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(["questions.1.text", "questions.2.timeLimitSecs"]));
    const many = Array.from({ length: 101 }, (_, i) => ({ ...ok, order: i }));
    expect((await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "Huge", isPublished: false, questions: many } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/v1/quizzes/save", headers: auth, payload: { title: "Max", isPublished: false, questions: many.slice(0, 100) } })).statusCode).toBe(201);
    await app.close();
  });
});
