import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { GameError, type EventAudience, type GameService } from "./game.js";

type Ack = (result: { ok: boolean; error?: string; state?: unknown }) => void;

export const playerRoom = (sessionId: string) => `game:${sessionId}`;
export const hostRoom = (sessionId: string) => `host:${sessionId}`;

export type RealtimeDeps = {
  gameService: GameService;
  /** Resolves a host JWT to the admin id, or throws. */
  verifyHostToken: (token: string) => string | Promise<string>;
};

export function attachRealtime(httpServer: HttpServer, deps: RealtimeDeps) {
  const io = new Server(httpServer, { cors: { origin: true } });
  const fail = (ack: Ack | undefined, error: unknown) =>
    ack?.({ ok: false, error: error instanceof GameError ? error.code : "invalid_request" });

  io.on("connection", (socket) => {
    // Player: must be a real, non-left participant of this session. The ack carries the
    // current state; in LOBBY that state has no question, so the player has nothing to show.
    socket.on("game:join", async (sessionId: unknown, participantId: unknown, ack?: Ack) => {
      if (typeof sessionId !== "string" || typeof participantId !== "string" || !sessionId || !participantId) {
        return fail(ack, null);
      }
      try {
        const state = await deps.gameService.participantState(sessionId, participantId);
        await socket.join(playerRoom(sessionId));
        socket.data.sessionId = sessionId;
        socket.data.participantId = participantId;
        ack?.({ ok: true, state });
      } catch (error) { fail(ack, error); }
    });

    // Host: authenticated with the admin JWT and must own the session.
    socket.on("host:join", async (sessionId: unknown, token: unknown, ack?: Ack) => {
      if (typeof sessionId !== "string" || typeof token !== "string" || !sessionId || !token) return fail(ack, null);
      try {
        const hostId = await deps.verifyHostToken(token);
        const state = await deps.gameService.hostState(sessionId, hostId);
        await socket.join(hostRoom(sessionId));
        socket.data.sessionId = sessionId;
        socket.data.hostId = hostId;
        ack?.({ ok: true, state });
      } catch (error) { fail(ack, error); }
    });
  });
  return io;
}

/** Routes game events: "host" events never reach the player room. */
export function roomEmitter(io: Server) {
  return (sessionId: string, event: string, payload: unknown, audience: EventAudience = "all") => {
    const target = audience === "host" ? io.to(hostRoom(sessionId)) : io.to(playerRoom(sessionId)).to(hostRoom(sessionId));
    target.emit(event, payload);
  };
}
