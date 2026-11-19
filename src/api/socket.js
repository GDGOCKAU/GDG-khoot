import { io } from "socket.io-client";

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
const browserSocketUrl = typeof window !== "undefined" && window.location.hostname
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : "http://localhost:3000";
export const SOCKET_URL = (configuredSocketUrl || browserSocketUrl).replace(/\/$/, "");

export function connectSocket() {
  return io(SOCKET_URL, { transports: ["websocket", "polling"] });
}
