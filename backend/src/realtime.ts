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
    socket.on("game:join", (sessionId: string, participantId: string, acknowledge?: (result: { ok: boolean }) => void) => {
      if (typeof sessionId !== "string" || sessionId.length === 0 || typeof participantId !== "string") {
        return acknowledge?.({ ok: false });
      }
      void socket.join(`game:${sessionId}`);
      socket.data.sessionId = sessionId;
      socket.data.participantId = participantId;
      acknowledge?.({ ok: true });
    });
  });
  return io;
}
