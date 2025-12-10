// Centralized API base helper — read from Vite env in production
export const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '';

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
