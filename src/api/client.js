/**
 * API base: Vite dev uses same-origin `/api` (proxied to FastAPI).
 * Production / beta: set VITE_API_BASE to your hosted API, e.g. https://api.example.com
 */
export function getApiBase() {
  const raw = import.meta.env.VITE_API_BASE;
  if (raw && String(raw).trim()) {
    return String(raw).replace(/\/$/, "");
  }
  return "";
}

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  if (base) return `${base}${p}`;
  return p;
}

export async function apiFetch(path, options = {}) {
  const url = apiUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
