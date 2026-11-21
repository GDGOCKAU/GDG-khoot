import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { GameError, type EventAudience, type GameService } from "./game.js";

type Ack = (result: { ok: boolean; error?: string; state?: unknown }) => void;

export const playerRoom = (sessionId: string) => `game:${sessionId}`;
export const hostRoom = (sessionId: string) => `host:${sessionId}`;
export const screenRoom = "screen";
export const participantRoom = (participantId: string) => `p:${participantId}`;

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
        await socket.join([playerRoom(sessionId), participantRoom(participantId)]);
        socket.data.sessionId = sessionId;
        socket.data.participantId = participantId;
        ack?.({ ok: true, state });
      } catch (error) { fail(ack, error); }
    });

    // Audience screen: read-only and public (it only gets what players already see, plus names
    // and scores). It follows the newest open session and carries no host rights.
    socket.on("screen:watch", async (ack?: Ack) => {
      try {
        await socket.join(screenRoom);
        ack?.({ ok: true, state: await deps.gameService.screenState() });
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
    // the audience screen hears everything players and the host hear, never a single player's private result
    if (audience === "all" || audience === "host") {
      const shown = event === "reveal_host" && payload && typeof payload === "object"
        ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "choices")) : payload;
      io.to(screenRoom).emit("screen:event", { sessionId, event, payload: shown });
    }
    const target = audience === "host" ? io.to(hostRoom(sessionId))
      : audience === "all" ? io.to(playerRoom(sessionId)).to(hostRoom(sessionId))
      : io.to(participantRoom(audience.participantId));
    target.emit(event, payload);
  };
}
