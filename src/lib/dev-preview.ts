// Temporary "preview mode": lets the owner open app screens without signing in
// while the backend is paused. Only allowed on localhost / Lovable preview hosts.
const KEY = "acemail-dev-preview";

export function devPreviewAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.includes("id-preview--") || h.endsWith(".lovableproject.com");
}

export function isDevPreview(): boolean {
  try {
    return devPreviewAllowed() && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevPreview(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {}
}
