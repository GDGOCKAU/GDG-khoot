import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { syncAdminPassword } from "../src/admin.js";
import { MemoryRepository } from "../src/repository/memory.js";
import { GameService, MemoryGameRepository } from "../src/game.js";

const run = promisify(execFile);
const EMAIL = "admin@gdg-kauhoot.local";

describe("admin password from .env", () => {
  it("creates the admin, leaves a matching password alone, replaces a changed one", async () => {
    const repository = new MemoryRepository();
    expect(await syncAdminPassword(repository, EMAIL, "first-password", 4)).toBe("created");
    const hash = repository.admins[0].passwordHash;
    expect(await syncAdminPassword(repository, EMAIL, "first-password", 4)).toBe("unchanged");
    expect(repository.admins[0].passwordHash).toBe(hash);
    expect(await syncAdminPassword(repository, EMAIL, "second-password", 4)).toBe("updated");
    expect(repository.admins).toHaveLength(1);
    await expect(syncAdminPassword(repository, EMAIL, "short", 4)).rejects.toThrow(/at least 8/);
  });

  it("after a change: the old password and old sign-ins stop working, the new password works", async () => {
    const repository = new MemoryRepository();
    await syncAdminPassword(repository, EMAIL, "old-password-1", 4);
    const app = buildApp(repository, "test-secret-that-is-long", new GameService(repository, new MemoryGameRepository()));
    const login = (password: string) => app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: EMAIL, password } });
    const oldToken = (await login("old-password-1")).json().token;
    const quizzes = (token: string) => app.inject({ method: "GET", url: "/api/v1/quizzes", headers: { authorization: `Bearer ${token}` } });
    expect((await quizzes(oldToken)).statusCode).toBe(200);
    await expect(app.verifyAdminToken(oldToken)).resolves.toBe(repository.admins[0].id);

    // the .env value changes and the server restarts
    await syncAdminPassword(repository, EMAIL, "new-password-2", 4);
    expect((await login("old-password-1")).statusCode).toBe(401);
    expect((await quizzes(oldToken)).statusCode).toBe(401);
    await expect(app.verifyAdminToken(oldToken)).rejects.toThrow();
    const newLogin = await login("new-password-2");
    expect(newLogin.statusCode).toBe(200);
    expect((await quizzes(newLogin.json().token)).statusCode).toBe(200);
    await app.close();
  });

  it("the server refuses to start with a missing or short ADMIN_PASSWORD, and says why", async () => {
    const start = (password: string | undefined) => run("npx", ["tsx", "src/config.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, DOTENV_CONFIG_PATH: "/nonexistent.env", ...(password === undefined ? { ADMIN_PASSWORD: "" } : { ADMIN_PASSWORD: password }) },
    }).then((r) => ({ code: 0, out: r.stdout + r.stderr }), (e) => ({ code: e.code as number, out: `${e.stdout}${e.stderr}` }));
    const empty = await start(undefined);
    expect(empty.code).toBe(1);
    expect(empty.out).toMatch(/ADMIN_PASSWORD in backend\/\.env is missing or empty/);
    const short = await start("abc12");
    expect(short.code).toBe(1);
    expect(short.out).toMatch(/too short \(5 characters\).*at least 8/);
    const example = await start("example-only-change-me");
    expect(example.code).toBe(1);
    expect(example.out).toMatch(/still the example value/);
    const good = await start("long-enough-1");
    expect(good.code).toBe(0);
    expect(good.out).not.toMatch(/will not start/);
  }, 30000);
});
