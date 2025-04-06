import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Get the hostname from the URL or environment
function getBasePath(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  
  // For local development
  if (mode === 'development') {
    return '/';
  }
  
  // For lovable.app domain
  if (env.DEPLOY_ENV === 'lovable' || env.LOVABLE === 'true') {
    console.log('Using base path for Lovable deployment');
    return '/';
  }
  
  // For GitHub Pages
  console.log('Using base path for GitHub Pages deployment');
  return '/previewcard-yapp/';
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Dynamically set the base path based on environment
  base: getBasePath(mode),
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
  // Make environment variables available to the client
  define: {
    'process.env.LOVABLE': JSON.stringify(process.env.LOVABLE),
    'process.env.DEPLOY_ENV': JSON.stringify(process.env.DEPLOY_ENV),
  },
}));
