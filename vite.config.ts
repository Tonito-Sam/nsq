import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("@tensorflow") || id.includes("nsfwjs")) {
            return "ai-vision";
          }

          return undefined;
        },
      },
    },
  },

  server: {
    host: "localhost",
    port: 8080,
    strictPort: true,
    watch: {
      ignored: ["**/*.zip"],
    },
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});