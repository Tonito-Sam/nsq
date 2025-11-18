// Centralized feature flags for runtime toggles.
// Set VITE_ENABLE_LIVE=true in your Vite environment to enable live features.
export const ENABLE_LIVE = import.meta.env.VITE_ENABLE_LIVE === 'true';
