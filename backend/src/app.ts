import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Repository } from "./domain.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const quizSchema = z.object({ title: z.string().trim().min(1).max(200), description: z.string().trim().max(2000).optional() });
const quizUpdateSchema = quizSchema.partial().extend({ isPublished: z.boolean().optional() });
const questionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  order: z.number().int().nonnegative(),
  timeLimitSecs: z.number().int().positive().max(600).optional(),
  options: z.array(z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() })).min(2),
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

export function buildApp(repository: Repository, jwtSecret: string): FastifyInstance {
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

  return app;
}
