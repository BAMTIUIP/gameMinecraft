import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * `/sdk.js` exists only on Yandex Games itself, or behind `@yandex-games/sdk-dev-proxy`, which
 * answers it before a request ever reaches Vite (see README). Anywhere else Vite's SPA fallback
 * would hand the browser index.html for it, and that chokes as JavaScript ("Unexpected token '<'").
 * Answer with an empty script instead: `window.YaGames` stays undefined and the game simply runs
 * without the SDK. Dev/preview servers only — nothing is emitted into the production build,
 * where Yandex serves the real file.
 */
function yandexSdkStub(): Plugin {
  const serveEmptyScript: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split("?")[0] !== "/sdk.js") return next();
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end("// Yandex Games SDK is only available on Yandex Games\n");
  };
  return {
    name: "yandex-sdk-stub",
    configureServer(server) {
      server.middlewares.use(serveEmptyScript);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveEmptyScript);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), yandexSdkStub()],
  server: {
    // allow the Arena preview host to reach the dev server
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
