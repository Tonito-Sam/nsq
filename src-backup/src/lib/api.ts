// Centralized API base helper — read from Vite env in production
// Support VITE_API_BASE_URL (preferred). In development, prefer relative paths so Vite's dev
// server proxy ("/api" -> backend) continues to work even if an older VITE_API_URL exists
const env = (import.meta as any).env || {};
// Support multiple possible env names for the API base to be forgiving of typos
// and differing deploy setups. Preferred: VITE_API_BASE_URL. Legacy: VITE_API_URL.
// Also accept VITE_BASE_API_BASE_URL and VITE_BASE_API_URL if present in .env.
const explicitBase = env?.VITE_API_BASE_URL || env?.VITE_BASE_API_BASE_URL || env?.VITE_BASE_API_URL;
const legacyBase = env?.VITE_API_URL;
export const API_BASE = (() => {
  // If an explicit new base is provided, use it always
  if (explicitBase) return explicitBase;
  // If running in a browser on localhost, prefer relative paths so the Vite proxy handles /api
  try {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '::1')) {
      return '';
    }
  } catch (e) {}
  // In development environments where MODE is explicitly set, prefer relative paths as well
  if ((env?.MODE === 'development' || env?.VITE_DEV_SERVER === 'true')) return '';
  // In production, fall back to legacy VITE_API_URL if present
  // If no env var is provided in production, default to the Render backend URL so
  // the static site will call the correct backend until you set VITE_API_BASE_URL
  // in your frontend deploy environment. Update this value if your backend URL changes.
  const RENDER_BACKEND_FALLBACK = 'https://nsq-98et.onrender.com';
  return legacyBase || RENDER_BACKEND_FALLBACK;
})();

export function apiUrl(path: string) {
  if (!path) return API_BASE || '';
  if (API_BASE) {
    // ensure single slash joining
    return `${API_BASE.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  // fallback to relative paths (dev with Vite proxy)
  return path.startsWith('/') ? path : `/${path}`;
}

export default apiUrl;
