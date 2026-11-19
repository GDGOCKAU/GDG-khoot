import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Repository } from "./domain.js";
import { GameError, type GameService } from "./game.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const quizSchema = z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional() });
const quizUpdateSchema = quizSchema.partial().extend({ isPublished: z.boolean().optional() });
const questionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  order: z.number().int().nonnegative(),
  timeLimitSecs: z.number().int().positive().max(600).optional(),
  options: z.array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() })).min(2),
});
const saveQuizSchema = z.object({
  quizId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  isPublished: z.boolean(),
  questions: z.array(z.object({
    text: z.string().trim().max(1000),
    order: z.number().int().nonnegative(),
    timeLimitSecs: z.number().int().positive().max(600),
    options: z.array(z.object({
      text: z.string().trim().max(500),
      isCorrect: z.boolean(),
    })).max(4),
  })),
});

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: { id: string; email: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export function buildApp(repository: Repository, jwtSecret: string, gameService?: GameService): FastifyInstance {
  const app = Fastify({ logger: false });
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
    return { token: app.jwt.sign({ id: admin.id, email: admin.email }) };
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  app.get("/api/v1/quizzes", { onRequest: [app.authenticate] }, async (request) => repository.listQuizzes(request.user.id));
  app.post("/api/v1/quizzes/save", { onRequest: [app.authenticate] }, async (request, reply) => {
    const parsed = saveQuizSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    if (parsed.data.isPublished) {
      const invalidPublish = parsed.data.questions.length === 0 || parsed.data.questions.some((question) =>
        !question.text || question.timeLimitSecs <= 0 ||
        question.options.length < 2 ||
        question.options.some((option) => !option.text) ||
        question.options.filter((option) => option.isCorrect).length !== 1
      );
      if (invalidPublish) return reply.code(400).send({ error: "invalid_publish_quiz" });
    }
    try {
      const quiz = await repository.saveQuiz({ ...parsed.data, hostId: request.user.id });
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
    const deleted = await repository.deleteQuiz(request.params.id, request.user.id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ error: "not_found" });
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
        const status = error.code === "session_not_found" || error.code === "quiz_not_found" || error.code === "participant_not_found"
          ? 404
          : error.code === "answer_already_submitted" || error.code === "duplicate_participant" ? 409 : 400;
        return reply.code(status).send({ error: error.code });
      }
      throw error;
    };

    app.post<{ Params: { id: string } }>("/api/v1/sessions", { onRequest: [app.authenticate] }, async (request, reply) => {
      try {
        const body = z.object({ quizId: z.string().uuid() }).parse(request.body);
        return reply.code(201).send(await gameService.createSession(body.quizId, request.user.id));
      } catch (error) { return gameError(reply, error); }
    });
    app.get("/api/v1/sessions/by-pin/:pin", async (request, reply) => {
      try {
        const params = request.params as { pin: string };
        return reply.send(await gameService.lookupByPin(params.pin));
      } catch (error) { return gameError(reply, error); }
    });
    app.post("/api/v1/sessions/join", async (request, reply) => {
      try {
        const body = z.object({ pin: z.string().regex(/^\d{6}$/), name: z.string().trim().min(1).max(40), mascot: z.string().trim().min(1).max(40), team: z.string().trim().min(1).max(40) }).parse(request.body);
        return reply.code(201).send(await gameService.joinByPin(body.pin, {
          name: body.name,
          mascot: body.mascot,
          team: body.team,
        }));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { quizId: string } }>("/api/v1/sessions/:id/start", { onRequest: [app.authenticate] }, async (request, reply) => {
      try {
        const body = z.object({ quizId: z.string().uuid() }).parse(request.body);
        return reply.send(await gameService.start(body.quizId, request.user.id, request.params.id));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { quizId: string } }>("/api/v1/sessions/:id/reveal", { onRequest: [app.authenticate] }, async (request, reply) => {
      try {
        const body = z.object({ quizId: z.string().uuid() }).parse(request.body);
        return reply.send(await gameService.reveal(body.quizId, request.user.id, request.params.id));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { quizId: string } }>("/api/v1/sessions/:id/next", { onRequest: [app.authenticate] }, async (request, reply) => {
      try {
        const body = z.object({ quizId: z.string().uuid() }).parse(request.body);
        return reply.send(await gameService.next(body.quizId, request.user.id, request.params.id));
      } catch (error) { return gameError(reply, error); }
    });
    app.get<{ Params: { id: string } }>("/api/v1/sessions/:id/leaderboard", async (request, reply) => {
      try { return reply.send(await gameService.leaderboard(request.params.id)); } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { participantId: string; questionId: string; optionId: string } }>("/api/v1/sessions/:id/answers", async (request, reply) => {
      try {
        const body = z.object({ participantId: z.string().uuid(), questionId: z.string().uuid(), optionId: z.string().uuid() }).parse(request.body);
        return reply.code(201).send(await gameService.answer(request.params.id, body.participantId, body.questionId, body.optionId));
      } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { participantId: string } }>("/api/v1/sessions/:id/leave", async (request, reply) => {
      try {
        const body = z.object({ participantId: z.string().uuid() }).parse(request.body);
        await gameService.leave(request.params.id, body.participantId);
        return reply.code(204).send();
      } catch (error) { return gameError(reply, error); }
    });
    app.post<{ Params: { id: string }; Body: { quizId: string } }>("/api/v1/sessions/:id/cancel", { onRequest: [app.authenticate] }, async (request, reply) => {
      try {
        const body = z.object({ quizId: z.string().uuid() }).parse(request.body);
        return reply.send(await gameService.cancel(body.quizId, request.user.id, request.params.id));
      } catch (error) { return gameError(reply, error); }
    });
  }

  return app;
}
