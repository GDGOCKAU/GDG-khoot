export function isBackendConfigured() {
  return Boolean(import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL);
}
