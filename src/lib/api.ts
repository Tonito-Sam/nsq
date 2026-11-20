// Centralized API base helper — read from Vite env in production
// Support VITE_API_BASE_URL (preferred). In development, prefer relative paths so Vite's dev
// server proxy ("/api" -> backend) continues to work even if an older VITE_API_URL exists
const env = (import.meta as any).env || {};
// Support multiple possible env names for the API base to be forgiving of typos
// and differing deploy setups. Preferred: VITE_API_BASE_URL. Legacy: VITE_API_URL.
// Also accept VITE_BASE_API_BASE_URL and VITE_BASE_API_URL if present in .env.
const explicitBase = env?.VITE_API_BASE_URL || env?.VITE_BASE_API_BASE_URL || env?.VITE_BASE_API_URL;
const legacyBase = env?.VITE_API_URL;
const RENDER_BACKEND_FALLBACK = 'https://nsq-98et.onrender.com';
const isLoopbackHostname = (hostname: string) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname === '[::1]'
  || hostname.endsWith('.localhost')
);

function pointsToLoopback(base: string, origin: string) {
  try {
    return isLoopbackHostname(new URL(base, origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function resolveApiBase({
  hostname,
  origin,
  explicitBase,
  legacyBase,
  mode,
  devServer,
}: {
  hostname?: string;
  origin?: string;
  explicitBase?: string;
  legacyBase?: string;
  mode?: string;
  devServer?: string;
}) {
  if (hostname && isLoopbackHostname(hostname.toLowerCase())) return '';

  const isDevelopment = mode === 'development' || devServer === 'true';
  if (explicitBase) {
    if (!isDevelopment && origin && pointsToLoopback(explicitBase, origin)) {
      console.warn('Ignoring a localhost API base on a remote site; using the production backend.');
    } else {
      return explicitBase;
    }
  }
  if (isDevelopment) return '';
  if (legacyBase) {
    if (origin && pointsToLoopback(legacyBase, origin)) {
      console.warn('Ignoring a localhost API base on a remote site; using the production backend.');
    } else {
      return legacyBase;
    }
  }
  return RENDER_BACKEND_FALLBACK;
}

export const API_BASE = resolveApiBase({
  hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  explicitBase,
  legacyBase,
  mode: env?.MODE,
  devServer: env?.VITE_DEV_SERVER,
});

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
