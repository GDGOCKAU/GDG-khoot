import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Quiz, Repository } from "./domain.js";
import { GameError, type GameService } from "./game.js";
import { normalizeQuestion, questionProblem, saveQuizSchema } from "./validation.js";

const pictureUrl = z.string().max(500).refine((value) => !value.startsWith("data:"), "upload images first; data URLs are not stored");
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const quizSchema = z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional() });
const quizUpdateSchema = quizSchema.partial().extend({ isPublished: z.boolean().optional() });
const questionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  order: z.number().int().nonnegative(),
  timeLimitSecs: z.number().int().positive().max(600).optional(),
  options: z.array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() })).min(2),
  type: z.enum(["mc", "tf", "code", "pic"]).optional(),
  code: z.string().trim().max(10000).optional(),
  language: z.string().trim().max(40).optional(),
  pictureUrls: z.array(pictureUrl).max(20).optional(),
  word: z.string().trim().max(100).optional(),
});
declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { id: string; email: string; pv?: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** A host token -> the admin id; throws when it is invalid or older than the current password. */
    verifyAdminToken: (token: string) => Promise<string>;
  }
}

/** File names under /uploads/ that a quiz's questions point to. */
function uploadedFiles(quiz: Quiz): string[] {
  return quiz.questions.flatMap((question) => [question.imageUrl, ...(question.pictureUrls ?? [])])
    .map((url) => /^\/uploads\/([0-9a-f-]{36}\.(?:png|jpg|webp|gif))$/.exec(url ?? "")?.[1])
    .filter((file): file is string => !!file);
}

/** A short fingerprint of the stored password hash, carried in tokens so a new password signs old sessions out. */
export const passwordVersion = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);

export function buildApp(repository: Repository, jwtSecret: string, gameService?: GameService, options: { uploadDir?: string } = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const uploadDir = path.resolve(options.uploadDir ?? "uploads");
  app.register(cors, { origin: true });
  app.register(jwt, { secret: jwtSecret });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const admin = await repository.findAdminByEmail(parsed.data.email);
    if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    return { token: app.jwt.sign({ id: admin.id, email: admin.email, pv: passwordVersion(admin.passwordHash) }) };
  });

  // a token is good only while the password it was issued under is still the current one
  const stillValid = async (user: { id: string; email: string; pv?: string }) => {
    const admin = await repository.findAdminByEmail(user.email);
    return !!admin && admin.id === user.id && user.pv === passwordVersion(admin.passwordHash);
  };
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (!(await stillValid(request.user))) throw new Error("password changed");
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
  app.decorate("verifyAdminToken", async (token: string) => {
    const user = app.jwt.verify<{ id: string; email: string; pv?: string }>(token);
    if (!(await stillValid(user))) throw new Error("unauthorized");
    return user.id;
  });

  // Images are stored as files on disk; only their /uploads/... path goes into PostgreSQL.
  app.post("/api/v1/uploads", { onRequest: [app.authenticate], bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const parsed = z.object({ dataUrl: z.string().max(4 * 1024 * 1024) }).safeParse(request.body);
    const match = parsed.success ? /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.dataUrl) : null;
    const ext = match ? IMAGE_TYPES[match[1]] : undefined;
    if (!match || !ext) return reply.code(400).send({ error: "invalid_image" });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return reply.code(400).send({ error: "invalid_image" });
    const file = `${randomUUID()}.${ext}`;
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, file), bytes);
    return reply.code(201).send({ url: `/uploads/${file}` });
  });
  app.get<{ Params: { file: string } }>("/uploads/:file", async (request, reply) => {
    const file = request.params.file;
    const match = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.exec(file);
    if (!match) return reply.code(404).send({ error: "not_found" });
    try {
      const bytes = await readFile(path.join(uploadDir, file));
      const type = Object.keys(IMAGE_TYPES).find((key) => IMAGE_TYPES[key] === match[1])!;
      return reply.header("content-type", type).header("cache-control", "public, max-age=86400").send(bytes);
    } catch { return reply.code(404).send({ error: "not_found" }); }
  });

  app.get("/api/v1/quizzes", { onRequest: [app.authenticate] }, async (request) => repository.listQuizzes(request.user.id));
  // public: what the home page lists. Metadata only; questions and answers stay on the server.
  app.get("/api/v1/public/quizzes", async () => repository.listPublishedQuizzes());
  app.post("/api/v1/quizzes/save", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = saveQuizSchema.safeParse(request.body);
    if (!parsed.success) {
      // issues carry their path ("questions.3.text"), so a client can point at the exact question
      const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten(), issues });
    }
    const questions = parsed.data.questions.map(normalizeQuestion);
    if (parsed.data.isPublished) {
      // publishing needs every question complete (drafts may autosave half-written questions)
      const problems = questions.map((question, index) => ({ index, problem: questionProblem(question) })).filter((item) => item.problem);
      if (problems.length) return reply.code(400).send({ error: "invalid_publish_quiz", problems });
    }
    try {
      const quiz = await repository.saveQuiz({ ...parsed.data, questions, hostId: request.user.id });
      return reply.code(parsed.data.quizId ? 200 : 201).send(quiz);
    } catch (error) {
      if (error instanceof Error && error.message === "quiz_not_found") {
        return reply.code(404).send({ error: "not_found" });
      }
      throw error;
    }
  });
  app.post("/api/v1/quizzes", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = quizSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    return reply.code(201).send(await repository.createQuiz({ ...parsed.data, hostId: request.user.id }));
  });
  app.get<{ Params: { id: string } }>("/api/v1/quizzes/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    const quiz = await repository.getQuiz(request.params.id, request.user.id);
    return quiz ? quiz : reply.code(404).send({ error: "not_found" });
  });
  app.patch<{ Params: { id: string } }>("/api/v1/quizzes/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = quizUpdateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const quiz = await repository.updateQuiz(request.params.id, request.user.id, parsed.data);
    return quiz ? quiz : reply.code(404).send({ error: "not_found" });
  });
  app.delete<{ Params: { id: string } }>("/api/v1/quizzes/:id", { onRequest: [app.authenticate] }, async (request, reply) => {
    // past games go with the quiz (cascade); a game being played right now blocks the delete
    if (gameService) {
      try { await gameService.releaseQuiz(request.user.id, request.params.id); } catch (error) {
        if (error instanceof GameError) return reply.code(409).send({ error: error.code });
        throw error;
      }
    }
    const quiz = await repository.getQuiz(request.params.id, request.user.id);
    const deleted = await repository.deleteQuiz(request.params.id, request.user.id);
    if (!deleted) return reply.code(404).send({ error: "not_found" });
    // its pictures go too, unless another quiz (e.g. a duplicate) still shows them
    if (quiz) {
      const stillUsed = new Set((await repository.listQuizzes(request.user.id)).flatMap(uploadedFiles));
      await Promise.all(uploadedFiles(quiz).filter((file) => !stillUsed.has(file))
        .map((file) => unlink(path.join(uploadDir, file)).catch(() => undefined)));
    }
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/api/v1/quizzes/:id/questions", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = questionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const quiz = await repository.getQuiz(request.params.id, request.user.id);
    if (!quiz) return reply.code(404).send({ error: "not_found" });
    const question = await repository.createQuestion({ ...parsed.data, quizId: quiz.id });
    return question ? reply.code(201).send(question) : reply.code(409).send({ error: "duplicate_question_order" });
  });

  if (gameService) {
    const gameError = (reply: FastifyReply, error: unknown) => {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "invalid_request", details: error.flatten() });
      }
      if (error instanceof GameError) {
        const status = error.code === "session_not_found" || error.code === "quiz_not_found" || error.code === "participant_not_found" ? 404
          : ["answer_already_submitted", "duplicate_participant", "game_started", "game_locked", "power_up_used"].includes(error.code) ? 409
          : error.code === "game_closed" ? 410
          : error.code === "kicked" ? 403 : 400;
        return reply.code(status).send({ error: error.code });
      }
      throw error;
    };
    const uuid = z.string().uuid();
    const host = { onRequest: [app.authenticate] };
    type Id = { Params: { id: string } };

    app.post("/api/v1/sessions", host, async (request, reply) => {
      try {
        const body = z.object({ quizId: uuid, powerUps: z.boolean().optional() }).parse(request.body);
        return reply.code(201).send(await gameService.createSession(body.quizId, request.user.id, { powerUps: body.powerUps }));
      } catch (error) { return gameError(reply, error); }
    });
    app.get<{ Params: { pin: string } }>("/api/v1/sessions/by-pin/:pin", async (request, reply) => {
      try { return reply.send(await gameService.lookupByPin(request.params.pin)); } catch (error) { return gameError(reply, error); }
    });
    app.post("/api/v1/sessions/join", async (request, reply) => {
      try {
        const body = z.object({ pin: z.string().regex(/^\d{6}$/), name: z.string().trim().min(1).max(40), mascot: z.string().trim().min(1).max(40), team: z.enum(["blue", "red", "yellow", "green"]), deviceId: z.string().trim().max(64).optional() }).parse(request.body);
        return reply.code(201).send(await gameService.joinByPin(body.pin, body));
      } catch (error) { return gameError(reply, error); }
    });
    // host controls: lobby settings (lock, power-ups), start, skip the running phase, end the game
    app.patch<Id>("/api/v1/sessions/:id/settings", host, async (request, reply) => {
      try {
        const body = z.object({ locked: z.boolean().optional(), powerUps: z.boolean().optional() }).parse(request.body);
        return reply.send(await gameService.settings(request.user.id, request.params.id, body));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<Id>("/api/v1/sessions/:id/start", host, async (request, reply) => {
      try { return reply.send(await gameService.start(request.user.id, request.params.id)); } catch (error) { return gameError(reply, error); }
    });
    app.post<Id>("/api/v1/sessions/:id/skip", host, async (request, reply) => {
      try { return reply.send(await gameService.skip(request.user.id, request.params.id)); } catch (error) { return gameError(reply, error); }
    });
    app.post<Id>("/api/v1/sessions/:id/cancel", host, async (request, reply) => {
      try { return reply.send(await gameService.cancel(request.user.id, request.params.id)); } catch (error) { return gameError(reply, error); }
    });
    app.get<Id>("/api/v1/sessions/:id/leaderboard", host, async (request, reply) => {
      try { return reply.send(await gameService.leaderboard(request.params.id)); } catch (error) { return gameError(reply, error); }
    });
    app.get("/api/v1/stats", host, async (request) => gameService.stats(request.user.id));
    // players
    app.post<Id>("/api/v1/sessions/:id/answers", async (request, reply) => {
      try {
        const body = z.object({
          participantId: uuid, questionId: uuid,
          optionId: uuid.optional(), text: z.string().max(100).optional(),
        }).refine((value) => value.optionId || value.text !== undefined).parse(request.body);
        const result = await gameService.answer(request.params.id, body.participantId, body.questionId, { optionId: body.optionId, text: body.text });
        // the player learns whether they were right only at Reveal
        return reply.code(201).send({ accepted: true, questionId: result.questionId });
      } catch (error) { return gameError(reply, error); }
    });
    app.post<Id>("/api/v1/sessions/:id/powerups", async (request, reply) => {
      try {
        const body = z.object({ participantId: uuid, kind: z.enum(["double", "fifty"]) }).parse(request.body);
        return reply.send(await gameService.usePowerUp(request.params.id, body.participantId, body.kind));
      } catch (error) { return gameError(reply, error); }
    });
    // a player changes their name / mascot (team) while in the lobby; their participant id is the credential
    app.patch<{ Params: { id: string; participantId: string } }>("/api/v1/sessions/:id/participants/:participantId", async (request, reply) => {
      try {
        const body = z.object({ name: z.string().trim().min(1).max(40), mascot: z.string().trim().min(1).max(40), team: z.enum(["blue", "red", "yellow", "green"]) }).parse(request.body);
        return reply.send(await gameService.updateParticipant(request.params.id, request.params.participantId, body));
      } catch (error) { return gameError(reply, error); }
    });
    // host only: remove a player from the lobby or the running game
    app.post<Id>("/api/v1/sessions/:id/kick", host, async (request, reply) => {
      try {
        const body = z.object({ participantId: uuid }).parse(request.body);
        return reply.send(await gameService.kick(request.user.id, request.params.id, body.participantId));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<Id>("/api/v1/sessions/:id/leave", async (request, reply) => {
      try {
        const body = z.object({ participantId: uuid }).parse(request.body);
        await gameService.leave(request.params.id, body.participantId);
        return reply.code(204).send();
      } catch (error) { return gameError(reply, error); }
    });
  }

  return app;
}
