import { io } from "socket.io-client";

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
/* same origin as the page (see api/client.js); Vite forwards /socket.io to the backend */
const browserSocketUrl = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
export const SOCKET_URL = (configuredSocketUrl || browserSocketUrl).replace(/\/$/, "");

export function connectSocket() {
  return io(SOCKET_URL, { transports: ["websocket", "polling"] });
}
