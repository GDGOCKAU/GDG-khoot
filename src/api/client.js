/* Same origin by default: the page's own address (LAN IP, localhost or a tunnel URL);
   Vite forwards /api, /socket.io and /uploads to the backend. VITE_API_URL overrides it. */
const configuredApiUrl = import.meta.env.VITE_API_URL;
const browserApiUrl = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
export const API_URL = (configuredApiUrl || browserApiUrl).replace(/\/$/, "");

/* uploaded images are stored as /uploads/... on the API server */
export function assetUrl(url) {
  return typeof url === "string" && url.startsWith("/uploads/") ? `${API_URL}${url}` : url;
}

export function getStoredToken() {
  return localStorage.getItem("gdgAdminToken") || "";
}

export async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}
