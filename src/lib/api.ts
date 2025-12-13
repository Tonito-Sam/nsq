// Centralized API base helper — read from Vite env in production
// Support either VITE_API_BASE_URL (preferred) or the older VITE_API_URL for compatibility
export const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL || '';

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
