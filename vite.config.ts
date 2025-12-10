import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    https: {
      key: fs.readFileSync("localhost-key.pem"),
      cert: fs.readFileSync("localhost-cert.pem"),
    },
    // Proxy local AI proxy endpoint to backend port where the Express ai-photo-studio-proxy runs
    proxy: {
      // Forward generic /api requests to the backend server (Express) running on :5000
      // This ensures client calls like /api/notifications are routed to the backend
      '/api': {
        // Frontend dev proxy -> backend. Backend in this workspace runs on 3001.
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // don't rewrite so paths like /api/ai-photo-studio still match more specific rules below
      },
      '/api/ai-photo-studio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Proxy remove.bg backend proxy to local backend so client can call /api/removebg
      '/api/removebg': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));