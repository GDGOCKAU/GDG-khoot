import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { buildApp } from "./app.js";
import { PrismaRepository } from "./repository/prisma.js";
import { attachRealtime } from "./realtime.js";

const prisma = new PrismaClient();
const app = buildApp(new PrismaRepository(prisma), config.JWT_SECRET);
const httpServer = createServer(app.server);
attachRealtime(httpServer);

await app.ready();
await new Promise<void>((resolve, reject) => {
  httpServer.once("error", reject);
  httpServer.listen(config.PORT, config.HOST, resolve);
});

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  httpServer.close();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
