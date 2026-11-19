import { io } from "socket.io-client";

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || "http://localhost:3000").replace(/\/$/, "");

export function connectSocket() {
  return io(SOCKET_URL, { transports: ["websocket", "polling"] });
}
