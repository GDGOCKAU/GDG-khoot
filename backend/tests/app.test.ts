import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { MemoryRepository } from "../src/repository/memory.js";

describe("backend API foundation", () => {
  const repositories: MemoryRepository[] = [];
  afterEach(() => repositories.pop());

  function setup() {
    const repository = new MemoryRepository();
    repository.admins.push({ id: "admin-1", email: "admin@example.com", passwordHash: bcrypt.hashSync("secret", 4) });
    repositories.push(repository);
    return { app: buildApp(repository, "test-secret-that-is-long"), repository };
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
});
