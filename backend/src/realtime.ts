import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

export function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: true } });
  io.on("connection", (socket) => {
    socket.on("session:join", (sessionId: string, acknowledge?: (result: { ok: boolean }) => void) => {
      if (typeof sessionId !== "string" || sessionId.length === 0) return acknowledge?.({ ok: false });
      void socket.join(`session:${sessionId}`);
      acknowledge?.({ ok: true });
    });
  });
  return io;
}
