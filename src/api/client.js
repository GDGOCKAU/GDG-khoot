const configuredApiUrl = import.meta.env.VITE_API_URL;
const browserApiUrl = typeof window !== "undefined" && window.location.hostname
  ? `${window.location.protocol}//${window.location.hostname}:3000`
  : "http://localhost:3000";
export const API_URL = (configuredApiUrl || browserApiUrl).replace(/\/$/, "");

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
