import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * `/sdk.js` handling for development:
 * - If `public/sdk.js` exists (mock SDK for local dev), serve it with visual ad placeholders
 * - Otherwise, return empty script (production will load real SDK from Yandex)
 * 
 * This plugin runs before Vite's SPA fallback, so `/sdk.js` never returns index.html.
 * The mock SDK is gitignored and only used locally — production builds don't include it.
 */
import { readFileSync, existsSync } from "fs";

function yandexSdkStub(): Plugin {
  const mockSdkPath = path.resolve(__dirname, "public/sdk.js");
  let mockSdkContent: string | null = null;
  
  // Load mock SDK if it exists (for local development)
  if (existsSync(mockSdkPath)) {
    try {
      mockSdkContent = `window.__yaVisualAdMock = true;\n${readFileSync(mockSdkPath, "utf-8")}`;
      console.log("[Vite] Mock SDK loaded from public/sdk.js (visual ad placeholders enabled)");
    } catch (err) {
      console.warn("[Vite] Failed to load mock SDK:", err);
    }
  }
  
  const serveSdk: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split("?")[0] !== "/sdk.js") return next();
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    
    if (mockSdkContent) {
      res.end(mockSdkContent);
    } else {
      res.end("// Yandex Games SDK is only available on Yandex Games\n");
    }
  };
  
  return {
    name: "yandex-sdk-stub",
    configureServer(server) {
      server.middlewares.use(serveSdk);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveSdk);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), yandexSdkStub()],
  server: {
    host: '0.0.0.0',
    // allow the Arena preview host to reach the dev server
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
