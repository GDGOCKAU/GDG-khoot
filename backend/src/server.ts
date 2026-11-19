import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { PrismaRepository } from "./repository/prisma.js";
import { PrismaGameRepository } from "./repository/prisma-game.js";
import { attachRealtime } from "./realtime.js";
import { GameService } from "./game.js";

const prisma = new PrismaClient();
const quizRepository = new PrismaRepository(prisma);
const gameRepository = new PrismaGameRepository(prisma);
const gameService = new GameService(
  quizRepository,
  gameRepository,
);
const app = buildApp(quizRepository, config.JWT_SECRET, gameService);

await app.ready();
const io = attachRealtime(app.server);
gameService.setEmitter((sessionId, event, payload) => io.to(`game:${sessionId}`).emit(event, payload));
await app.listen({ port: config.PORT, host: config.HOST });

const shutdown = async () => {
  io.close();
  await app.close();
  await prisma.$disconnect();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
