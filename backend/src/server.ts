import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { PrismaRepository } from "./repository/prisma.js";
import { PrismaGameRepository } from "./repository/prisma-game.js";
import { attachRealtime, roomEmitter } from "./realtime.js";
import { GameService } from "./game.js";
import { syncAdminPassword } from "./admin.js";

const prisma = new PrismaClient();
const quizRepository = new PrismaRepository(prisma);
const gameRepository = new PrismaGameRepository(prisma);
const gameService = new GameService(
  quizRepository,
  gameRepository,
);
// ADMIN_PASSWORD in .env is the admin password: a changed value replaces the stored hash
const adminSync = await syncAdminPassword(quizRepository, config.ADMIN_EMAIL, config.ADMIN_PASSWORD);
console.log(`admin password: ${adminSync === "unchanged" ? "matches .env" : adminSync === "created" ? "admin created from .env" : "updated from .env (older sign-ins are signed out)"}`);
const app = buildApp(quizRepository, config.JWT_SECRET, gameService, { uploadDir: config.UPLOAD_DIR });

await app.ready();
const io = attachRealtime(app.server, {
  gameService,
  verifyHostToken: (token) => app.verifyAdminToken(token),
});
gameService.setEmitter(roomEmitter(io));
await app.listen({ port: config.PORT, host: config.HOST });

const shutdown = async () => {
  io.close();
  await app.close();
  await prisma.$disconnect();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
