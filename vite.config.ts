import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Repository name from GitHub URL
const repoName = 'previewcard-yapp';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use /repository-name/ as base URL in production
  base: mode === 'production' ? `/${repoName}/` : '/',
  server: {
    host: "::",
    port: 8080,
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
